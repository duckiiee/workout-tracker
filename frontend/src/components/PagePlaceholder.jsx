export default function PagePlaceholder({ title, description, icon, children }) {
  return (
    <div className="page-shell">
      <header>
        <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl glass-inset text-gray-700">
          {icon}
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="page-desc">{description}</p>
      </header>

      <div className="glass-card-lg border-dashed py-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
          Đang phát triển
        </p>
        <p className="mt-2 text-sm font-medium text-gray-500">
          Nội dung trang này sẽ được bổ sung trong các bản cập nhật tiếp theo.
        </p>
        {children}
      </div>
    </div>
  );
}
