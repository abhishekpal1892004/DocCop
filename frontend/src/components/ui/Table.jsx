export function Table({ columns, rows, keyField = '_id', emptyMessage = 'No records found.' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E6E0D4] p-8 text-center text-sm text-[#57534E]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E6E0D4] overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#E6E0D4] bg-[#FAF7F2]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[#57534E] whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFEAE0] text-sm text-[#1C1917]">
            {rows.map((row, idx) => (
              <tr key={row[keyField] || idx} className="hover:bg-[#FAF7F2]/70 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3.5 align-middle">
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-[#EFEAE0]">
        {rows.map((row, idx) => (
          <div key={row[keyField] || idx} className="p-4 space-y-2.5">
            {columns.map((col) => (
              <div key={col.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-xs font-medium text-[#57534E] shrink-0">{col.header}</span>
                <div className="text-right text-[#1C1917] min-w-0 break-words">
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
