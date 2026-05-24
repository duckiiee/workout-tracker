require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sql = require('mssql');

const app = express();
const PORT = process.env.PORT || 5000;

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

let pool;

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
  'WorkoutID, WorkoutDate, Notes, IsCompleted';

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
  if (err.number === 547) {
    const error = new Error(
      'Cannot complete operation due to a related record constraint.'
    );
    error.statusCode = 409;
    return error;
  }
  if (err.number === 2627 || err.number === 2601) {
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
  'ds.TemplateID, ds.DayOfWeek, ds.ExerciseID, ds.Sets, ds.Reps, ds.Weight';

const DEFAULT_SCHEDULE_SELECT = `
  SELECT ${DEFAULT_SCHEDULE_COLUMNS},
         e.Name AS ExerciseName, e.MuscleGroup
  FROM DefaultWeeklySchedule ds
  INNER JOIN Exercises e ON ds.ExerciseID = e.ExerciseID
`;

// --- User Profile ---

app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT TOP 1 ProfileID, FullName, Height, TargetGoal
      FROM UserProfile
      ORDER BY ProfileID
    `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch profile.');
  }
});

app.put('/api/profile', async (req, res) => {
  try {
    const data = validateProfileBody(req.body);

    const existing = await pool
      .request()
      .input('ProfileID', sql.Int, data.ProfileID)
      .query('SELECT ProfileID FROM UserProfile WHERE ProfileID = @ProfileID');

    let result;

    if (existing.recordset.length === 0) {
      result = await pool
        .request()
        .input('FullName', sql.NVarChar(100), data.FullName)
        .input('Height', sql.Decimal(5, 2), data.Height)
        .input('TargetGoal', sql.NVarChar(255), data.TargetGoal)
        .query(`
          INSERT INTO UserProfile (FullName, Height, TargetGoal)
          OUTPUT INSERTED.ProfileID, INSERTED.FullName, INSERTED.Height, INSERTED.TargetGoal
          VALUES (@FullName, @Height, @TargetGoal)
        `);
    } else {
      result = await pool
        .request()
        .input('ProfileID', sql.Int, data.ProfileID)
        .input('FullName', sql.NVarChar(100), data.FullName)
        .input('Height', sql.Decimal(5, 2), data.Height)
        .input('TargetGoal', sql.NVarChar(255), data.TargetGoal)
        .query(`
          UPDATE UserProfile
          SET FullName = @FullName,
              Height = @Height,
              TargetGoal = @TargetGoal
          OUTPUT INSERTED.ProfileID, INSERTED.FullName, INSERTED.Height, INSERTED.TargetGoal
          WHERE ProfileID = @ProfileID
        `);
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update profile.');
  }
});

// --- Body Weight History ---

app.get('/api/weight', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT RecordID, RecordDate, Weight
      FROM BodyWeightHistory
      ORDER BY RecordDate DESC, RecordID DESC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch weight history.');
  }
});

app.post('/api/weight', async (req, res) => {
  try {
    const { RecordDate, Weight } = validateWeightBody(req.body);

    const result = await pool
      .request()
      .input('RecordDate', sql.Date, RecordDate)
      .input('Weight', sql.Decimal(6, 2), Weight)
      .query(`
        INSERT INTO BodyWeightHistory (RecordDate, Weight)
        OUTPUT INSERTED.RecordID, INSERTED.RecordDate, INSERTED.Weight
        VALUES (@RecordDate, @Weight)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to save weight record.');
  }
});

// --- Exercises ---

app.get('/api/exercises', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT ExerciseID, Name, MuscleGroup
      FROM Exercises
      ORDER BY Name
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch exercises.');
  }
});

app.post('/api/exercises', async (req, res) => {
  try {
    const { Name, MuscleGroup } = validateExerciseBody(req.body);

    const result = await pool
      .request()
      .input('Name', sql.NVarChar(100), Name)
      .input('MuscleGroup', sql.NVarChar(100), MuscleGroup)
      .query(`
        INSERT INTO Exercises (Name, MuscleGroup)
        OUTPUT INSERTED.ExerciseID, INSERTED.Name, INSERTED.MuscleGroup
        VALUES (@Name, @MuscleGroup)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create exercise.');
  }
});

// --- Default Weekly Schedule ---

app.get('/api/default-schedule', async (req, res) => {
  try {
    const result = await pool.request().query(`
      ${DEFAULT_SCHEDULE_SELECT}
      ORDER BY ds.DayOfWeek ASC, ds.TemplateID ASC
    `);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch default schedule.');
  }
});

app.get('/api/default-schedule/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'TemplateID');
    const result = await pool
      .request()
      .input('TemplateID', sql.Int, id)
      .query(`${DEFAULT_SCHEDULE_SELECT} WHERE ds.TemplateID = @TemplateID`);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Default schedule entry with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch default schedule entry.');
  }
});

app.post('/api/default-schedule', async (req, res) => {
  try {
    const data = validateDefaultScheduleBody(req.body);

    const exerciseExists = await pool
      .request()
      .input('ExerciseID', sql.Int, data.ExerciseID)
      .query('SELECT 1 FROM Exercises WHERE ExerciseID = @ExerciseID');

    if (exerciseExists.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Exercise with ID ${data.ExerciseID} not found.`,
      });
    }

    const insertResult = await pool
      .request()
      .input('DayOfWeek', sql.Int, data.DayOfWeek)
      .input('ExerciseID', sql.Int, data.ExerciseID)
      .input('Sets', sql.Int, data.Sets)
      .input('Reps', sql.Int, data.Reps)
      .input('Weight', sql.Decimal(10, 2), data.Weight)
      .query(`
        INSERT INTO DefaultWeeklySchedule (DayOfWeek, ExerciseID, Sets, Reps, Weight)
        OUTPUT INSERTED.TemplateID
        VALUES (@DayOfWeek, @ExerciseID, @Sets, @Reps, @Weight)
      `);

    const templateId = insertResult.recordset[0].TemplateID;
    const result = await pool
      .request()
      .input('TemplateID', sql.Int, templateId)
      .query(`${DEFAULT_SCHEDULE_SELECT} WHERE ds.TemplateID = @TemplateID`);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create default schedule entry.');
  }
});

app.put('/api/default-schedule/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'TemplateID');
    const data = validateDefaultScheduleBody(req.body, { partial: false });

    const exerciseExists = await pool
      .request()
      .input('ExerciseID', sql.Int, data.ExerciseID)
      .query('SELECT 1 FROM Exercises WHERE ExerciseID = @ExerciseID');

    if (exerciseExists.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Exercise with ID ${data.ExerciseID} not found.`,
      });
    }

    const updateResult = await pool
      .request()
      .input('TemplateID', sql.Int, id)
      .input('DayOfWeek', sql.Int, data.DayOfWeek)
      .input('ExerciseID', sql.Int, data.ExerciseID)
      .input('Sets', sql.Int, data.Sets)
      .input('Reps', sql.Int, data.Reps)
      .input('Weight', sql.Decimal(10, 2), data.Weight)
      .query(`
        UPDATE DefaultWeeklySchedule
        SET DayOfWeek = @DayOfWeek,
            ExerciseID = @ExerciseID,
            Sets = @Sets,
            Reps = @Reps,
            Weight = @Weight
        OUTPUT INSERTED.TemplateID
        WHERE TemplateID = @TemplateID
      `);

    if (updateResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Default schedule entry with ID ${id} not found.`,
      });
    }

    const result = await pool
      .request()
      .input('TemplateID', sql.Int, id)
      .query(`${DEFAULT_SCHEDULE_SELECT} WHERE ds.TemplateID = @TemplateID`);

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update default schedule entry.');
  }
});

app.delete('/api/default-schedule/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'TemplateID');
    const result = await pool
      .request()
      .input('TemplateID', sql.Int, id)
      .query(
        'DELETE FROM DefaultWeeklySchedule OUTPUT DELETED.TemplateID WHERE TemplateID = @TemplateID'
      );

    if (result.recordset.length === 0) {
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
    const request = pool.request();
    let query = `SELECT ${WORKOUT_COLUMNS} FROM Workouts`;
    const conditions = [];

    if (startDate && endDate) {
      request.input('StartDate', sql.Date, new Date(startDate));
      request.input('EndDate', sql.Date, new Date(endDate));
      conditions.push(
        'CAST(WorkoutDate AS DATE) >= @StartDate AND CAST(WorkoutDate AS DATE) <= @EndDate'
      );
    } else if (filterDate) {
      request.input('FilterDate', sql.Date, new Date(filterDate));
      conditions.push('CAST(WorkoutDate AS DATE) = @FilterDate');
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY WorkoutDate ASC, WorkoutID ASC';
    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workouts.');
  }
});

app.get('/api/workouts/today-details', async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT
        wd.DetailID,
        wd.WorkoutID,
        wd.ExerciseID,
        wd.Sets,
        wd.Reps,
        wd.Weight,
        wd.IsCompleted,
        e.Name AS ExerciseName,
        e.MuscleGroup,
        w.WorkoutDate
      FROM WorkoutDetails wd
      INNER JOIN Workouts w ON wd.WorkoutID = w.WorkoutID
      INNER JOIN Exercises e ON wd.ExerciseID = e.ExerciseID
      WHERE CAST(w.WorkoutDate AS DATE) = CAST(GETDATE() AS DATE)
      ORDER BY w.WorkoutID ASC, wd.DetailID ASC
    `);

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    sendError(res, handleDbError(err), 'Failed to fetch today workout details.');
  }
});

app.post('/api/workouts/apply-default', async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const startDate = parseDateQuery(req.body.startDate, 'startDate');
    if (!startDate) {
      const error = new Error('startDate is required (YYYY-MM-DD).');
      error.statusCode = 400;
      throw error;
    }

    const templatesResult = await pool.request().query(`
      SELECT TemplateID, DayOfWeek, ExerciseID, Sets, Reps, Weight
      FROM DefaultWeeklySchedule
      ORDER BY DayOfWeek ASC, TemplateID ASC
    `);

    const templates = templatesResult.recordset;
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

    await transaction.begin();

    let workoutsCreated = 0;
    let detailsCreated = 0;
    const workoutIdByDate = new Map();

    for (const template of templates) {
      const offset = dayOfWeekToOffset(template.DayOfWeek);
      const workoutDate = addDaysToDate(startDate, offset);
      const dateKey = formatDateKey(workoutDate);

      let workoutId = workoutIdByDate.get(dateKey);

      if (!workoutId) {
        const findRequest = new sql.Request(transaction);
        const existing = await findRequest
          .input('WorkoutDate', sql.Date, workoutDate)
          .query(`
            SELECT TOP 1 WorkoutID
            FROM Workouts
            WHERE CAST(WorkoutDate AS DATE) = CAST(@WorkoutDate AS DATE)
            ORDER BY WorkoutID ASC
          `);

        if (existing.recordset.length > 0) {
          workoutId = existing.recordset[0].WorkoutID;
        } else {
          const insertWorkoutRequest = new sql.Request(transaction);
          const inserted = await insertWorkoutRequest
            .input('WorkoutDate', sql.Date, workoutDate)
            .input('Notes', sql.NVarChar(sql.MAX), `Buổi tập ${dateKey}`)
            .query(`
              INSERT INTO Workouts (WorkoutDate, Notes, IsCompleted)
              OUTPUT INSERTED.WorkoutID
              VALUES (@WorkoutDate, @Notes, 0)
            `);
          workoutId = inserted.recordset[0].WorkoutID;
          workoutsCreated += 1;
        }

        workoutIdByDate.set(dateKey, workoutId);
      }

      const insertDetailRequest = new sql.Request(transaction);
      await insertDetailRequest
        .input('WorkoutID', sql.Int, workoutId)
        .input('ExerciseID', sql.Int, template.ExerciseID)
        .input('Sets', sql.Int, template.Sets)
        .input('Reps', sql.Int, template.Reps)
        .input('Weight', sql.Decimal(10, 2), template.Weight)
        .query(`
          INSERT INTO WorkoutDetails (WorkoutID, ExerciseID, Sets, Reps, Weight, IsCompleted)
          VALUES (@WorkoutID, @ExerciseID, @Sets, @Reps, @Weight, 0)
        `);
      detailsCreated += 1;
    }

    await transaction.commit();

    res.json({
      success: true,
      data: {
        startDate,
        workoutsCreated,
        detailsCreated,
      },
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {
      /* transaction may not have started */
    }
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to apply default schedule.');
  }
});

app.get('/api/workouts/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');
    const result = await pool
      .request()
      .input('WorkoutID', sql.Int, id)
      .query(
        `SELECT ${WORKOUT_COLUMNS} FROM Workouts WHERE WorkoutID = @WorkoutID`
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workout.');
  }
});

app.post('/api/workouts', async (req, res) => {
  try {
    const { WorkoutDate, Notes } = validateWorkoutBody(req.body);

    const result = await pool
      .request()
      .input('WorkoutDate', sql.Date, WorkoutDate)
      .input('Notes', sql.NVarChar(sql.MAX), Notes)
      .query(`
        INSERT INTO Workouts (WorkoutDate, Notes, IsCompleted)
        OUTPUT INSERTED.WorkoutID, INSERTED.WorkoutDate, INSERTED.Notes, INSERTED.IsCompleted
        VALUES (@WorkoutDate, @Notes, 0)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create workout.');
  }
});

app.put('/api/workouts/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');
    const { WorkoutDate, Notes } = validateWorkoutBody(req.body, { partial: false });

    const result = await pool
      .request()
      .input('WorkoutID', sql.Int, id)
      .input('WorkoutDate', sql.Date, WorkoutDate)
      .input('Notes', sql.NVarChar(sql.MAX), Notes)
      .query(`
        UPDATE Workouts
        SET WorkoutDate = @WorkoutDate, Notes = @Notes
        OUTPUT INSERTED.WorkoutID, INSERTED.WorkoutDate, INSERTED.Notes, INSERTED.IsCompleted
        WHERE WorkoutID = @WorkoutID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update workout.');
  }
});

app.put('/api/workouts/:id/complete', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'WorkoutID');
    const isCompleted = parseIsCompleted(req.body.IsCompleted);

    const result = await pool
      .request()
      .input('WorkoutID', sql.Int, id)
      .input('IsCompleted', sql.Bit, isCompleted)
      .query(`
        UPDATE Workouts
        SET IsCompleted = @IsCompleted
        OUTPUT INSERTED.WorkoutID, INSERTED.WorkoutDate, INSERTED.Notes, INSERTED.IsCompleted
        WHERE WorkoutID = @WorkoutID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update workout completion.');
  }
});

app.delete('/api/workouts/:id', async (req, res) => {
  const transaction = new sql.Transaction(pool);

  try {
    const id = parseId(req.params.id, 'WorkoutID');
    await transaction.begin();

    const deleteDetailsRequest = new sql.Request(transaction);
    await deleteDetailsRequest
      .input('WorkoutID', sql.Int, id)
      .query('DELETE FROM WorkoutDetails WHERE WorkoutID = @WorkoutID');

    const deleteWorkoutRequest = new sql.Request(transaction);
    const result = await deleteWorkoutRequest
      .input('WorkoutID', sql.Int, id)
      .query('DELETE FROM Workouts OUTPUT DELETED.WorkoutID WHERE WorkoutID = @WorkoutID');

    if (result.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${id} not found.`,
      });
    }

    await transaction.commit();
    res.json({
      success: true,
      message: `Workout with ID ${id} and its details were deleted.`,
    });
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_) {
      /* transaction may not have started */
    }
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to delete workout.');
  }
});

// --- WorkoutDetails ---

app.get('/api/workout-details', async (req, res) => {
  try {
    const request = pool.request();
    const startDate = parseDateQuery(req.query.startDate, 'startDate');
    const endDate = parseDateQuery(req.query.endDate, 'endDate');
    let query = `
      SELECT wd.DetailID, wd.WorkoutID, wd.ExerciseID, wd.Sets, wd.Reps, wd.Weight,
             wd.IsCompleted, w.WorkoutDate
      FROM WorkoutDetails wd
      INNER JOIN Workouts w ON wd.WorkoutID = w.WorkoutID
    `;
    const conditions = [];

    if (req.query.workoutId !== undefined) {
      const workoutId = parseId(req.query.workoutId, 'WorkoutID');
      request.input('WorkoutID', sql.Int, workoutId);
      conditions.push('wd.WorkoutID = @WorkoutID');
    }

    if (startDate && endDate) {
      request.input('StartDate', sql.Date, new Date(startDate));
      request.input('EndDate', sql.Date, new Date(endDate));
      conditions.push(
        'CAST(w.WorkoutDate AS DATE) >= @StartDate AND CAST(w.WorkoutDate AS DATE) <= @EndDate'
      );
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY w.WorkoutDate ASC, wd.DetailID ASC';
    const result = await request.query(query);
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workout details.');
  }
});

app.get('/api/workout-details/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');
    const result = await pool
      .request()
      .input('DetailID', sql.Int, id)
      .query(`
        SELECT DetailID, WorkoutID, ExerciseID, Sets, Reps, Weight, IsCompleted
        FROM WorkoutDetails
        WHERE DetailID = @DetailID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to fetch workout detail.');
  }
});

app.post('/api/workout-details', async (req, res) => {
  try {
    const data = validateWorkoutDetailBody(req.body);

    const workoutExists = await pool
      .request()
      .input('WorkoutID', sql.Int, data.WorkoutID)
      .query('SELECT 1 FROM Workouts WHERE WorkoutID = @WorkoutID');

    if (workoutExists.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout with ID ${data.WorkoutID} not found.`,
      });
    }

    const result = await pool
      .request()
      .input('WorkoutID', sql.Int, data.WorkoutID)
      .input('ExerciseID', sql.Int, data.ExerciseID)
      .input('Sets', sql.Int, data.Sets)
      .input('Reps', sql.Int, data.Reps)
      .input('Weight', sql.Decimal(10, 2), data.Weight)
      .query(`
        INSERT INTO WorkoutDetails (WorkoutID, ExerciseID, Sets, Reps, Weight, IsCompleted)
        OUTPUT INSERTED.DetailID, INSERTED.WorkoutID, INSERTED.ExerciseID,
               INSERTED.Sets, INSERTED.Reps, INSERTED.Weight, INSERTED.IsCompleted
        VALUES (@WorkoutID, @ExerciseID, @Sets, @Reps, @Weight, 0)
      `);

    res.status(201).json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to create workout detail.');
  }
});

app.put('/api/workout-details/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');
    const data = validateWorkoutDetailBody(req.body, { partial: false });

    if (data.WorkoutID !== undefined) {
      const workoutExists = await pool
        .request()
        .input('WorkoutID', sql.Int, data.WorkoutID)
        .query('SELECT 1 FROM Workouts WHERE WorkoutID = @WorkoutID');

      if (workoutExists.recordset.length === 0) {
        return res.status(404).json({
          success: false,
          message: `Workout with ID ${data.WorkoutID} not found.`,
        });
      }
    }

    const result = await pool
      .request()
      .input('DetailID', sql.Int, id)
      .input('WorkoutID', sql.Int, data.WorkoutID)
      .input('ExerciseID', sql.Int, data.ExerciseID)
      .input('Sets', sql.Int, data.Sets)
      .input('Reps', sql.Int, data.Reps)
      .input('Weight', sql.Decimal(10, 2), data.Weight)
      .query(`
        UPDATE WorkoutDetails
        SET WorkoutID = @WorkoutID,
            ExerciseID = @ExerciseID,
            Sets = @Sets,
            Reps = @Reps,
            Weight = @Weight
        OUTPUT INSERTED.DetailID, INSERTED.WorkoutID, INSERTED.ExerciseID,
               INSERTED.Sets, INSERTED.Reps, INSERTED.Weight, INSERTED.IsCompleted
        WHERE DetailID = @DetailID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    res.json({ success: true, data: result.recordset[0] });
  } catch (err) {
    sendError(res, err.statusCode ? err : handleDbError(err), 'Failed to update workout detail.');
  }
});

app.put('/api/workout-details/:id/complete', async (req, res) => {
  try {
    const id = parseId(req.params.id, 'DetailID');
    const isCompleted = parseIsCompleted(req.body.IsCompleted);

    const result = await pool
      .request()
      .input('DetailID', sql.Int, id)
      .input('IsCompleted', sql.Bit, isCompleted)
      .query(`
        UPDATE WorkoutDetails
        SET IsCompleted = @IsCompleted
        OUTPUT INSERTED.DetailID, INSERTED.WorkoutID, INSERTED.ExerciseID,
               INSERTED.Sets, INSERTED.Reps, INSERTED.Weight, INSERTED.IsCompleted
        WHERE DetailID = @DetailID
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    const updatedDetail = result.recordset[0];
    const workoutId = updatedDetail.WorkoutID;

    const summaryResult = await pool
      .request()
      .input('WorkoutID', sql.Int, workoutId)
      .query(`
        SELECT
          COUNT(*) AS TotalDetails,
          SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS CompletedDetails
        FROM WorkoutDetails
        WHERE WorkoutID = @WorkoutID
      `);

    const { TotalDetails, CompletedDetails } = summaryResult.recordset[0];
    const workoutComplete = isWorkoutSessionComplete(TotalDetails, CompletedDetails);

    await pool
      .request()
      .input('WorkoutID', sql.Int, workoutId)
      .input('IsCompleted', sql.Bit, workoutComplete)
      .query(`
        UPDATE Workouts
        SET IsCompleted = @IsCompleted
        WHERE WorkoutID = @WorkoutID
      `);

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

    const existing = await pool
      .request()
      .input('DetailID', sql.Int, id)
      .query('SELECT WorkoutID FROM WorkoutDetails WHERE DetailID = @DetailID');

    if (existing.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Workout detail with ID ${id} not found.`,
      });
    }

    const workoutId = existing.recordset[0].WorkoutID;

    await pool
      .request()
      .input('DetailID', sql.Int, id)
      .query('DELETE FROM WorkoutDetails WHERE DetailID = @DetailID');

    const summaryResult = await pool
      .request()
      .input('WorkoutID', sql.Int, workoutId)
      .query(`
        SELECT
          COUNT(*) AS TotalDetails,
          SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS CompletedDetails
        FROM WorkoutDetails
        WHERE WorkoutID = @WorkoutID
      `);

    const { TotalDetails, CompletedDetails } = summaryResult.recordset[0];
    const workoutComplete = isWorkoutSessionComplete(TotalDetails, CompletedDetails);

    await pool
      .request()
      .input('WorkoutID', sql.Int, workoutId)
      .input('IsCompleted', sql.Bit, workoutComplete)
      .query(`
        UPDATE Workouts
        SET IsCompleted = @IsCompleted
        WHERE WorkoutID = @WorkoutID
      `);

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
      pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM Workouts) AS TotalWorkouts,
          (SELECT COUNT(*) FROM Workouts WHERE IsCompleted = 1) AS CompletedWorkouts,
          (SELECT ISNULL(SUM(CAST(Sets AS FLOAT) * Reps * Weight), 0) FROM WorkoutDetails) AS TotalVolumeKg,
          (SELECT COUNT(*) FROM WorkoutDetails) AS TotalSets,
          (SELECT COUNT(*) FROM Exercises) AS TotalExercises
      `),
      pool.request().query(`
        SELECT
          FORMAT(WorkoutDate, 'yyyy-MM') AS Month,
          COUNT(*) AS Total,
          SUM(CASE WHEN IsCompleted = 1 THEN 1 ELSE 0 END) AS Completed
        FROM Workouts
        GROUP BY FORMAT(WorkoutDate, 'yyyy-MM')
        ORDER BY Month
      `),
      pool.request().query(`
        SELECT TOP 8
          e.Name,
          e.MuscleGroup,
          COUNT(*) AS UsageCount,
          ISNULL(SUM(CAST(wd.Sets AS FLOAT) * wd.Reps * wd.Weight), 0) AS TotalVolumeKg
        FROM WorkoutDetails wd
        INNER JOIN Exercises e ON wd.ExerciseID = e.ExerciseID
        GROUP BY e.Name, e.MuscleGroup
        ORDER BY UsageCount DESC, TotalVolumeKg DESC
      `),
      pool.request().query(`
        SELECT RecordID, RecordDate, Weight
        FROM BodyWeightHistory
        ORDER BY RecordDate ASC, RecordID ASC
      `),
    ]);

    const summary = summaryResult.recordset[0];
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
        workoutsByMonth: monthlyResult.recordset,
        topExercises: topExercisesResult.recordset,
        weightHistory: weightResult.recordset,
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
    pool = await sql.connect(dbConfig);
    console.log('Database connected successfully');
    return pool;
  } catch (err) {
    console.error('Database connection failed:', err.message);
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
