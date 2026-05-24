// Chỉ đọc file .env nếu đang ở máy cá nhân (development)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase PostgreSQL (Session mode — port 5432). Pool dùng cùng thông số với Client.
const dbConfig = {
  user: 'postgres',
  host: 'db.glcydvwcipxapugljsen.supabase.co',
  database: 'postgres',
  password: 'Hoangduc02@',
  port: 5432,
  ssl: { rejectUnauthorized: false },
};

let pool;

function formatConnectionError(err) {
  const parts = [err.message, err.code].filter(Boolean);
  if (err.errors?.length) {
    parts.push(...err.errors.map((e) => e.message || String(e)).filter(Boolean));
  }
  return parts.join(' — ') || String(err);
}

async function query(text, params = [], client = pool) {
  return client.query(text, params);
}

async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

app.use(cors());
app.use(express.json());

function parseId(value, name = 'ID') {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(`Invalid ${name}. Must be a positive integer.`);
    error.statusCode = 400;
    throw error;
  }
  return id;
}

function sendError(res, err, defaultMessage = 'Internal server error') {
  const statusCode = err.statusCode || 500;
  const message = err.statusCode ? err.message : defaultMessage;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(err.details && { details: err.details }),
  });
}

const WORKOUT_COLUMNS =
  '"WorkoutID", "WorkoutDate", "Notes", "IsCompleted"';

function parseDateQuery(value, paramName = 'date') {
  if (value === undefined || value === null || value === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    const error = new Error(`Invalid ${paramName}. Use YYYY-MM-DD format.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function handleDbError(err) {
  if (err.code === '23503') {
    const error = new Error(
      'Cannot complete operation due to a related record constraint.'
    );
    error.statusCode = 409;
    return error;
  }
  if (err.code === '23505') {
    const error = new Error('A record with this value already exists.');
    error.statusCode = 409;
    return error;
  }
  return err;
}

function validateWorkoutBody(body, { partial = false } = {}) {
  const errors = [];
  const { WorkoutDate, Notes } = body;

  if (!partial || WorkoutDate !== undefined) {
    if (WorkoutDate === undefined || WorkoutDate === null || WorkoutDate === '') {
      errors.push('WorkoutDate is required.');
    } else if (Number.isNaN(Date.parse(WorkoutDate))) {
      errors.push('WorkoutDate must be a valid date.');
    }
  }

  if (!partial || Notes !== undefined) {
    if (Notes !== undefined && Notes !== null && typeof Notes !== 'string') {
      errors.push('Notes must be a string.');
    }
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    WorkoutDate: WorkoutDate !== undefined ? new Date(WorkoutDate) : undefined,
    Notes: Notes !== undefined ? Notes : null,
  };
}

function validateWorkoutDetailBody(body, { partial = false } = {}) {
  const errors = [];
  const { WorkoutID, ExerciseID, Sets, Reps, Weight } = body;

  const checkInt = (value, field, required) => {
    if (value === undefined || value === null) {
      if (required) errors.push(`${field} is required.`);
      return;
    }
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      errors.push(`${field} must be a positive integer.`);
    }
  };

  const checkNumber = (value, field, required) => {
    if (value === undefined || value === null) {
      if (required) errors.push(`${field} is required.`);
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      errors.push(`${field} must be a non-negative number.`);
    }
  };

  if (!partial) {
    checkInt(WorkoutID, 'WorkoutID', true);
    checkInt(ExerciseID, 'ExerciseID', true);
    checkNumber(Sets, 'Sets', true);
    checkNumber(Reps, 'Reps', true);
    checkNumber(Weight, 'Weight', true);
  } else {
    if (WorkoutID !== undefined) checkInt(WorkoutID, 'WorkoutID', false);
    if (ExerciseID !== undefined) checkInt(ExerciseID, 'ExerciseID', false);
    if (Sets !== undefined) checkNumber(Sets, 'Sets', false);
    if (Reps !== undefined) checkNumber(Reps, 'Reps', false);
    if (Weight !== undefined) checkNumber(Weight, 'Weight', false);
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    WorkoutID: WorkoutID !== undefined ? Number(WorkoutID) : undefined,
    ExerciseID: ExerciseID !== undefined ? Number(ExerciseID) : undefined,
    Sets: Sets !== undefined ? Number(Sets) : undefined,
    Reps: Reps !== undefined ? Number(Reps) : undefined,
    Weight: Weight !== undefined ? Number(Weight) : undefined,
  };
}

function validateProfileBody(body) {
  const errors = [];
  const { ProfileID, FullName, Height, TargetGoal } = body;

  if (ProfileID !== undefined && ProfileID !== null) {
    const id = Number(ProfileID);
    if (!Number.isInteger(id) || id <= 0) {
      errors.push('ProfileID must be a positive integer.');
    }
  }

  if (FullName !== undefined && FullName !== null && typeof FullName !== 'string') {
    errors.push('FullName must be a string.');
  }

  if (Height !== undefined && Height !== null) {
    const height = Number(Height);
    if (Number.isNaN(height) || height <= 0) {
      errors.push('Height must be a positive number (cm).');
    }
  }

  if (TargetGoal !== undefined && TargetGoal !== null && typeof TargetGoal !== 'string') {
    errors.push('TargetGoal must be a string.');
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    ProfileID: ProfileID !== undefined ? Number(ProfileID) : 1,
    FullName: FullName !== undefined ? FullName : null,
    Height: Height !== undefined ? Number(Height) : null,
    TargetGoal: TargetGoal !== undefined ? TargetGoal : null,
  };
}

function validateWeightBody(body) {
  const errors = [];
  const { RecordDate, Weight } = body;

  if (RecordDate === undefined || RecordDate === null || RecordDate === '') {
    errors.push('RecordDate is required.');
  } else if (Number.isNaN(Date.parse(RecordDate))) {
    errors.push('RecordDate must be a valid date.');
  }

  if (Weight === undefined || Weight === null) {
    errors.push('Weight is required.');
  } else {
    const weight = Number(Weight);
    if (Number.isNaN(weight) || weight <= 0) {
      errors.push('Weight must be a positive number (kg).');
    }
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    RecordDate: new Date(RecordDate),
    Weight: Number(Weight),
  };
}

function validateExerciseBody(body) {
  const errors = [];
  const name = body.Name ?? body.ExerciseName;
  const { MuscleGroup } = body;

  if (name === undefined || name === null || typeof name !== 'string' || name.trim() === '') {
    errors.push('Name is required and must be a non-empty string.');
  }

  if (MuscleGroup !== undefined && MuscleGroup !== null && typeof MuscleGroup !== 'string') {
    errors.push('MuscleGroup must be a string.');
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    Name: name.trim(),
    MuscleGroup: MuscleGroup !== undefined ? MuscleGroup?.trim() || null : null,
  };
}

function parseIsCompleted(value) {
  if (value === undefined || value === null) {
    const error = new Error('IsCompleted is required (true or false).');
    error.statusCode = 400;
    throw error;
  }
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  const error = new Error('IsCompleted must be a boolean.');
  error.statusCode = 400;
  throw error;
}

function isWorkoutSessionComplete(totalDetails, completedDetails) {
  const total = Number(totalDetails) || 0;
  const completed = Number(completedDetails) || 0;
  if (total === 0 || completed === 0) return false;
  const threshold = Math.ceil(total / 2);
  return completed >= threshold;
}

function dayOfWeekToOffset(dayOfWeek) {
  const dow = Number(dayOfWeek);
  if (!Number.isInteger(dow) || dow < 2 || dow > 8) {
    const error = new Error('DayOfWeek must be an integer from 2 (Monday) to 8 (Sunday).');
    error.statusCode = 400;
    throw error;
  }
  return dow === 8 ? 6 : dow - 2;
}

function addDaysToDate(dateStr, days) {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date;
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function validateDefaultScheduleBody(body, { partial = false } = {}) {
  const errors = [];
  const { DayOfWeek, ExerciseID, Sets, Reps, Weight } = body;

  if (!partial || DayOfWeek !== undefined) {
    const dow = Number(DayOfWeek);
    if (DayOfWeek === undefined || DayOfWeek === null) {
      errors.push('DayOfWeek is required.');
    } else if (!Number.isInteger(dow) || dow < 2 || dow > 8) {
      errors.push('DayOfWeek must be an integer from 2 (Monday) to 8 (Sunday).');
    }
  }

  const checkInt = (value, field, required) => {
    if (value === undefined || value === null) {
      if (required) errors.push(`${field} is required.`);
      return;
    }
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      errors.push(`${field} must be a positive integer.`);
    }
  };

  const checkNumber = (value, field, required) => {
    if (value === undefined || value === null) {
      if (required) errors.push(`${field} is required.`);
      return;
    }
    const num = Number(value);
    if (Number.isNaN(num) || num < 0) {
      errors.push(`${field} must be a non-negative number.`);
    }
  };

  if (!partial) {
    checkInt(ExerciseID, 'ExerciseID', true);
    checkNumber(Sets, 'Sets', true);
    checkNumber(Reps, 'Reps', true);
    checkNumber(Weight, 'Weight', true);
  } else {
    if (ExerciseID !== undefined) checkInt(ExerciseID, 'ExerciseID', false);
    if (Sets !== undefined) checkNumber(Sets, 'Sets', false);
    if (Reps !== undefined) checkNumber(Reps, 'Reps', false);
    if (Weight !== undefined) checkNumber(Weight, 'Weight', false);
  }

  if (errors.length > 0) {
    const error = new Error('Validation failed.');
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    DayOfWeek: DayOfWeek !== undefined ? Number(DayOfWeek) : undefined,
    ExerciseID: ExerciseID !== undefined ? Number(ExerciseID) : undefined,
    Sets: Sets !== undefined ? Number(Sets) : undefined,
    Reps: Reps !== undefined ? Number(Reps) : undefined,
    Weight: Weight !== undefined ? Number(Weight) : undefined,
  };
}

const DEFAULT_SCHEDULE_COLUMNS =
  'ds."TemplateID", ds."DayOfWeek", ds."ExerciseID", ds."Sets", ds."Reps", ds."Weight"';

const DEFAULT_SCHEDULE_SELECT = `
  SELECT ${DEFAULT_SCHEDULE_COLUMNS},
         e."Name" AS "ExerciseName", e."MuscleGroup"
  FROM "DefaultWeeklySchedule" ds
  INNER JOIN "Exercises" e ON ds."ExerciseID" = e."ExerciseID"
`;

// --- User Profile ---

app.get('/api/profile', async (req, res) => {
  try {
    const result = await query(`
      SELECT "ProfileID", "FullName", "Height", "TargetGoal"
      FROM "UserProfile"
      ORDER BY "ProfileID"
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch profile.');
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const data = validateProfileBody(req.body);

    const existing = await query(
      'SELECT "ProfileID" FROM "UserProfile" WHERE "ProfileID" = $1',
      [data.ProfileID]
    );

    let result;

    if (existing.rows.length === 0) {
      result = await query(
        `
          INSERT INTO "UserProfile" ("FullName", "Height", "TargetGoal")
          VALUES ($1, $2, $3)
          RETURNING "ProfileID", "FullName", "Height", "TargetGoal"
        `,
        [data.FullName, data.Height, data.TargetGoal]
      );
    } else {
      result = await query(
        `
          UPDATE "UserProfile"
          SET "FullName" = $1,
              "Height" = $2,
              "TargetGoal" = $3
          WHERE "ProfileID" = $4
          RETURNING "ProfileID", "FullName", "Height", "TargetGoal"
        `,
        [data.FullName, data.Height, data.TargetGoal, data.ProfileID]
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update profile.');
  }
});

// --- Body Weight History ---

app.get('/api/weight', async (req, res) => {
  try {
    const result = await query(`
      SELECT "RecordID", "RecordDate", "Weight"
      FROM "BodyWeightHistory"
      ORDER BY "RecordDate" DESC, "RecordID" DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch weight history.');
  }
});

app.post('/api/weight', async (req, res) => {
  try {
    const { RecordDate, Weight } = validateWeightBody(req.body);

    const result = await query(
      `
        INSERT INTO "BodyWeightHistory" ("RecordDate", "Weight")
        VALUES ($1, $2)
        RETURNING "RecordID", "RecordDate", "Weight"
      `,
      [RecordDate, Weight]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to save weight record.');
  }
});

// --- Exercises ---

app.get('/api/exercises', async (req, res) => {
  try {
    const result = await query(`
      SELECT "ExerciseID", "Name", "MuscleGroup"
      FROM "Exercises"
      ORDER BY "Name"
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch exercises.');
  }
});

app.post('/api/exercises', async (req, res) => {
  try {
    const { Name, MuscleGroup } = validateExerciseBody(req.body);

    const result = await query(
      `
        INSERT INTO "Exercises" ("Name", "MuscleGroup")
        VALUES ($1, $2)
        RETURNING "ExerciseID", "Name", "MuscleGroup"
      `,
      [Name, MuscleGroup]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create exercise.');
  }
});

// --- Default Weekly Schedule ---

app.get('/api/default-schedule', async (req, res) => {
  try {
    const result = await query(`
      ${DEFAULT_SCHEDULE_SELECT}
      ORDER BY ds."DayOfWeek" ASC, ds."TemplateID" ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch default schedule.');
  }
});

app.get('/api/default-schedule/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'TemplateID');
    const result = await query(
      `${DEFAULT_SCHEDULE_SELECT} WHERE ds."TemplateID" = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Default schedule entry with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch default schedule entry.');
  }
});

app.post('/api/default-schedule', async (req, res) => {
  try {
    const data = validateDefaultScheduleBody(req.body);

    const exerciseExists = await query(
      'SELECT 1 FROM "Exercises" WHERE "ExerciseID" = $1',
      [data.ExerciseID]
    );

    if (exerciseExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Exercise with ID ${data.ExerciseID} not found.`,
      });
    }

    const insertResult = await query(
      `
        INSERT INTO "DefaultWeeklySchedule" ("DayOfWeek", "ExerciseID", "Sets", "Reps", "Weight")
        VALUES ($1, $2, $3, $4, $5)
        RETURNING "TemplateID"
      `,
      [data.DayOfWeek, data.ExerciseID, data.Sets, data.Reps, data.Weight]
    );

    const templateId = insertResult.rows[0].TemplateID;
    const result = await query(
      `${DEFAULT_SCHEDULE_SELECT} WHERE ds."TemplateID" = $1`,
      [templateId]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create default schedule entry.');
  }
});

app.put('/api/default-schedule/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'TemplateID');
    const data = validateDefaultScheduleBody(req.body, { partial: false });

    const exerciseExists = await query(
      'SELECT 1 FROM "Exercises" WHERE "ExerciseID" = $1',
      [data.ExerciseID]
    );

    if (exerciseExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Exercise with ID ${data.ExerciseID} not found.`,
      });
    }

    const updateResult = await query(
      `
        UPDATE "DefaultWeeklySchedule"
        SET "DayOfWeek" = $1,
            "ExerciseID" = $2,
            "Sets" = $3,
            "Reps" = $4,
            "Weight" = $5
        WHERE "TemplateID" = $6
        RETURNING "TemplateID"
      `,
      [data.DayOfWeek, data.ExerciseID, data.Sets, data.Reps, data.Weight, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Default schedule entry with ID ${id} not found.`,
      });
    }

    const result = await query(
      `${DEFAULT_SCHEDULE_SELECT} WHERE ds."TemplateID" = $1`,
      [id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update default schedule entry.');
  }
});

app.delete('/api/default-schedule/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'TemplateID');
    const result = await query(
      'DELETE FROM "DefaultWeeklySchedule" WHERE "TemplateID" = $1 RETURNING "TemplateID"',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Default schedule entry with ID ${id} not found.`,
      });
    }

    res.json({
      success: true,
      message: `Default schedule entry with ID ${id} was deleted.`,
    });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to delete default schedule entry.');
  }
});

// --- Workouts ---

app.get('/api/workouts', async (req, res) => {
  try {
    const filterDate = parseDateQuery(req.query.date);
    const startDate = parseDateQuery(req.query.startDate, 'startDate');
    const endDate = parseDateQuery(req.query.endDate, 'endDate');
    const params = [];
    const conditions = [];
    let queryText = `SELECT ${WORKOUT_COLUMNS} FROM "Workouts"`;

    if (startDate && endDate) {
      params.push(startDate, endDate);
      conditions.push(
        `CAST("WorkoutDate" AS DATE) >= $${params.length - 1}::date AND CAST("WorkoutDate" AS DATE) <= $${params.length}::date`
      );
    } else if (filterDate) {
      params.push(filterDate);
      conditions.push(`CAST("WorkoutDate" AS DATE) = $${params.length}::date`);
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY "WorkoutDate" ASC, "WorkoutID" ASC';
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workouts.');
  }
});

app.get('/api/workouts/today-details', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        wd."DetailID",
        wd."WorkoutID",
        wd."ExerciseID",
        wd."Sets",
        wd."Reps",
        wd."Weight",
        wd."IsCompleted",
        e."Name" AS "ExerciseName",
        e."MuscleGroup",
        w."WorkoutDate"
      FROM "WorkoutDetails" wd
      INNER JOIN "Workouts" w ON wd."WorkoutID" = w."WorkoutID"
      INNER JOIN "Exercises" e ON wd."ExerciseID" = e."ExerciseID"
      WHERE CAST(w."WorkoutDate" AS DATE) = CURRENT_DATE
      ORDER BY w."WorkoutID" ASC, wd."DetailID" ASC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch today workout details.');
  }
});

app.post('/api/workouts/apply-default', async (req, res) => {
  try {
    const startDate = parseDateQuery(req.body.startDate, 'startDate');
    if (!startDate) {
      const error = new Error('startDate is required (YYYY-MM-DD).');
      error.statusCode = 400;
      throw error;
    }

    const templatesResult = await query(`
      SELECT "TemplateID", "DayOfWeek", "ExerciseID", "Sets", "Reps", "Weight"
      FROM "DefaultWeeklySchedule"
      ORDER BY "DayOfWeek" ASC, "TemplateID" ASC
    `);

    const templates = templatesResult.rows;
    if (templates.length === 0) {
      return res.json({
        success: true,
        data: {
          startDate,
          workoutsCreated: 0,
          detailsCreated: 0,
          message: 'No default schedule templates found.',
        },
      });
    }

    const txResult = await withTransaction(async (client) => {
      let workoutsCreated = 0;
      let detailsCreated = 0;
      const workoutIdByDate = new Map();

      for (const template of templates) {
        const offset = dayOfWeekToOffset(template.DayOfWeek);
        const workoutDate = addDaysToDate(startDate, offset);
        const dateKey = formatDateKey(workoutDate);

        let workoutId = workoutIdByDate.get(dateKey);

        if (!workoutId) {
          const existing = await query(
            `
              SELECT "WorkoutID"
              FROM "Workouts"
              WHERE CAST("WorkoutDate" AS DATE) = CAST($1 AS DATE)
              ORDER BY "WorkoutID" ASC
              LIMIT 1
            `,
            [workoutDate],
            client
          );

          if (existing.rows.length > 0) {
            workoutId = existing.rows[0].WorkoutID;
          } else {
            const inserted = await query(
              `
                INSERT INTO "Workouts" ("WorkoutDate", "Notes", "IsCompleted")
                VALUES ($1, $2, false)
                RETURNING "WorkoutID"
              `,
              [workoutDate, `Buổi tập ${dateKey}`],
              client
            );
            workoutId = inserted.rows[0].WorkoutID;
            workoutsCreated += 1;
          }

          workoutIdByDate.set(dateKey, workoutId);
        }

        await query(
          `
            INSERT INTO "WorkoutDetails" ("WorkoutID", "ExerciseID", "Sets", "Reps", "Weight", "IsCompleted")
            VALUES ($1, $2, $3, $4, $5, false)
          `,
          [
            workoutId,
            template.ExerciseID,
            template.Sets,
            template.Reps,
            template.Weight,
          ],
          client
        );
        detailsCreated += 1;
      }

      return { workoutsCreated, detailsCreated };
    });

    res.json({
      success: true,
      data: {
        startDate,
        workoutsCreated: txResult.workoutsCreated,
        detailsCreated: txResult.detailsCreated,
      },
    });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to apply default schedule.');
  }
});

app.get('/api/workouts/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');
    const result = await query(
      `SELECT ${WORKOUT_COLUMNS} FROM "Workouts" WHERE "WorkoutID" = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workout.');
  }
});

app.post('/api/workouts', async (req, res) => {
  try {
    const { WorkoutDate, Notes } = validateWorkoutBody(req.body);

    const result = await query(
      `
        INSERT INTO "Workouts" ("WorkoutDate", "Notes", "IsCompleted")
        VALUES ($1, $2, false)
        RETURNING ${WORKOUT_COLUMNS}
      `,
      [WorkoutDate, Notes]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create workout.');
  }
});

app.put('/api/workouts/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');
    const { WorkoutDate, Notes } = validateWorkoutBody(req.body, { partial: false });

    const result = await query(
      `
        UPDATE "Workouts"
        SET "WorkoutDate" = $1, "Notes" = $2
        WHERE "WorkoutID" = $3
        RETURNING ${WORKOUT_COLUMNS}
      `,
      [WorkoutDate, Notes, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update workout.');
  }
});

app.put('/api/workouts/:id/complete', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');
    const isCompleted = parseIsCompleted(req.body.IsCompleted);

    const result = await query(
      `
        UPDATE "Workouts"
        SET "IsCompleted" = $1
        WHERE "WorkoutID" = $2
        RETURNING ${WORKOUT_COLUMNS}
      `,
      [isCompleted, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update workout completion.');
  }
});

app.delete('/api/workouts/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');

    const deleted = await withTransaction(async (client) => {
      await query(
        'DELETE FROM "WorkoutDetails" WHERE "WorkoutID" = $1',
        [id],
        client
      );

      const result = await query(
        'DELETE FROM "Workouts" WHERE "WorkoutID" = $1 RETURNING "WorkoutID"',
        [id],
        client
      );

      return result;
    });

    if (deleted.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({
      success: true,
      message: `Workout with ID ${id} and its details were deleted.`,
    });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to delete workout.');
  }
});

// --- WorkoutDetails ---

const WORKOUT_DETAIL_COLUMNS =
  '"DetailID", "WorkoutID", "ExerciseID", "Sets", "Reps", "Weight", "IsCompleted"';

app.get('/api/workout-details', async (req, res) => {
  try {
    const startDate = parseDateQuery(req.query.startDate, 'startDate');
    const endDate = parseDateQuery(req.query.endDate, 'endDate');
    const params = [];
    const conditions = [];
    let queryText = `
      SELECT wd."DetailID", wd."WorkoutID", wd."ExerciseID", wd."Sets", wd."Reps", wd."Weight",
             wd."IsCompleted", w."WorkoutDate"
      FROM "WorkoutDetails" wd
      INNER JOIN "Workouts" w ON wd."WorkoutID" = w."WorkoutID"
    `;

    if (req.query.workoutId !== undefined) {
      const workoutId = parseId(req.query.workoutId, 'WorkoutID');
      params.push(workoutId);
      conditions.push(`wd."WorkoutID" = $${params.length}`);
    }

    if (startDate && endDate) {
      params.push(startDate, endDate);
      conditions.push(
        `CAST(w."WorkoutDate" AS DATE) >= $${params.length - 1}::date AND CAST(w."WorkoutDate" AS DATE) <= $${params.length}::date`
      );
    }

    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }

    queryText += ' ORDER BY w."WorkoutDate" ASC, wd."DetailID" ASC';
    const result = await query(queryText, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workout details.');
  }
});

app.get('/api/workout-details/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');
    const result = await query(
      `
        SELECT ${WORKOUT_DETAIL_COLUMNS}
        FROM "WorkoutDetails"
        WHERE "DetailID" = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workout detail.');
  }
});

app.post('/api/workout-details', async (req, res) => {
  try {
    const data = validateWorkoutDetailBody(req.body);

    const workoutExists = await query(
      'SELECT 1 FROM "Workouts" WHERE "WorkoutID" = $1',
      [data.WorkoutID]
    );

    if (workoutExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${data.WorkoutID} not found.`,
      });
    }

    const result = await query(
      `
        INSERT INTO "WorkoutDetails" ("WorkoutID", "ExerciseID", "Sets", "Reps", "Weight", "IsCompleted")
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING ${WORKOUT_DETAIL_COLUMNS}
      `,
      [data.WorkoutID, data.ExerciseID, data.Sets, data.Reps, data.Weight]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create workout detail.');
  }
});

app.put('/api/workout-details/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');
    const data = validateWorkoutDetailBody(req.body, { partial: false });

    if (data.WorkoutID !== undefined) {
      const workoutExists = await query(
        'SELECT 1 FROM "Workouts" WHERE "WorkoutID" = $1',
        [data.WorkoutID]
      );

      if (workoutExists.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Workout with ID ${data.WorkoutID} not found.`,
        });
      }
    }

    const result = await query(
      `
        UPDATE "WorkoutDetails"
        SET "WorkoutID" = $1,
            "ExerciseID" = $2,
            "Sets" = $3,
            "Reps" = $4,
            "Weight" = $5
        WHERE "DetailID" = $6
        RETURNING ${WORKOUT_DETAIL_COLUMNS}
      `,
      [data.WorkoutID, data.ExerciseID, data.Sets, data.Reps, data.Weight, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update workout detail.');
  }
});

app.put('/api/workout-details/:id/complete', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');
    const isCompleted = parseIsCompleted(req.body.IsCompleted);

    const result = await query(
      `
        UPDATE "WorkoutDetails"
        SET "IsCompleted" = $1
        WHERE "DetailID" = $2
        RETURNING ${WORKOUT_DETAIL_COLUMNS}
      `,
      [isCompleted, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    const updatedDetail = result.rows[0];
    const workoutId = updatedDetail.WorkoutID;

    const summaryResult = await query(
      `
        SELECT
          COUNT(*)::int AS "TotalDetails",
          SUM(CASE WHEN "IsCompleted" THEN 1 ELSE 0 END)::int AS "CompletedDetails"
        FROM "WorkoutDetails"
        WHERE "WorkoutID" = $1
      `,
      [workoutId]
    );

    const { TotalDetails, CompletedDetails } = summaryResult.rows[0];
    const workoutComplete = isWorkoutSessionComplete(TotalDetails, CompletedDetails);

    await query(
      `
        UPDATE "Workouts"
        SET "IsCompleted" = $1
        WHERE "WorkoutID" = $2
      `,
      [workoutComplete, workoutId]
    );

    res.json({
      success: true,
      data: updatedDetail,
      workoutCompleted: workoutComplete,
    });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update detail completion.');
  }
});

app.delete('/api/workout-details/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');

    const existing = await query(
      'SELECT "WorkoutID" FROM "WorkoutDetails" WHERE "DetailID" = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    const workoutId = existing.rows[0].WorkoutID;

    await query('DELETE FROM "WorkoutDetails" WHERE "DetailID" = $1', [id]);

    const summaryResult = await query(
      `
        SELECT
          COUNT(*)::int AS "TotalDetails",
          SUM(CASE WHEN "IsCompleted" THEN 1 ELSE 0 END)::int AS "CompletedDetails"
        FROM "WorkoutDetails"
        WHERE "WorkoutID" = $1
      `,
      [workoutId]
    );

    const { TotalDetails, CompletedDetails } = summaryResult.rows[0];
    const workoutComplete = isWorkoutSessionComplete(TotalDetails, CompletedDetails);

    await query(
      `
        UPDATE "Workouts"
        SET "IsCompleted" = $1
        WHERE "WorkoutID" = $2
      `,
      [workoutComplete, workoutId]
    );

    res.json({
      success: true,
      message: `Workout detail with ID ${id} was deleted.`,
      workoutId,
      workoutCompleted: workoutComplete,
    });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to delete workout detail.');
  }
});

// --- Statistics ---

app.get('/api/statistics', async (req, res) => {
  try {
    const [
      summaryResult,
      monthlyResult,
      topExercisesResult,
      weightResult,
    ] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM "Workouts") AS "TotalWorkouts",
          (SELECT COUNT(*)::int FROM "Workouts" WHERE "IsCompleted" = true) AS "CompletedWorkouts",
          (SELECT COALESCE(SUM("Sets"::float * "Reps" * "Weight"), 0) FROM "WorkoutDetails") AS "TotalVolumeKg",
          (SELECT COUNT(*)::int FROM "WorkoutDetails") AS "TotalSets",
          (SELECT COUNT(*)::int FROM "Exercises") AS "TotalExercises"
      `),
      query(`
        SELECT
          TO_CHAR("WorkoutDate", 'YYYY-MM') AS "Month",
          COUNT(*)::int AS "Total",
          SUM(CASE WHEN "IsCompleted" THEN 1 ELSE 0 END)::int AS "Completed"
        FROM "Workouts"
        GROUP BY TO_CHAR("WorkoutDate", 'YYYY-MM')
        ORDER BY "Month"
      `),
      query(`
        SELECT
          e."Name",
          e."MuscleGroup",
          COUNT(*)::int AS "UsageCount",
          COALESCE(SUM(wd."Sets"::float * wd."Reps" * wd."Weight"), 0) AS "TotalVolumeKg"
        FROM "WorkoutDetails" wd
        INNER JOIN "Exercises" e ON wd."ExerciseID" = e."ExerciseID"
        GROUP BY e."Name", e."MuscleGroup"
        ORDER BY "UsageCount" DESC, "TotalVolumeKg" DESC
        LIMIT 8
      `),
      query(`
        SELECT "RecordID", "RecordDate", "Weight"
        FROM "BodyWeightHistory"
        ORDER BY "RecordDate" ASC, "RecordID" ASC
      `),
    ]);

    const summary = summaryResult.rows[0];
    const totalWorkouts = summary.TotalWorkouts || 0;
    const completedWorkouts = summary.CompletedWorkouts || 0;

    res.json({
      success: true,
      data: {
        summary: {
          totalWorkouts,
          completedWorkouts,
          completionRate:
            totalWorkouts > 0
              ? Math.round((completedWorkouts / totalWorkouts) * 1000) / 10
              : 0,
          totalVolumeKg: Math.round((summary.TotalVolumeKg || 0) * 10) / 10,
          totalSets: summary.TotalSets || 0,
          totalExercises: summary.TotalExercises || 0,
        },
        workoutsByMonth: monthlyResult.rows,
        topExercises: topExercisesResult.rows,
        weightHistory: weightResult.rows,
      },
    });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch statistics.');
  }
});

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

async function connectDatabase() {
  try {
    pool = new Pool(dbConfig);
    await pool.query('SELECT 1');
    console.log('Database connected successfully');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', formatConnectionError(err));
    process.exit(1);
  }
}

async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
