import React from "react";

export type AdminTableColumn<Row> = {
  key: keyof Row;
  header: string;
  className?: string;
  render?: (value: Row[keyof Row], row: Row) => React.ReactNode;
};

export type AdminTableProps<Row> = {
  columns: AdminTableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
};

export function AdminTable<Row extends { id: string | number }>({
  columns,
  rows,
  emptyMessage = "No data to display.",
}: AdminTableProps<Row>) {
  return (
    <section className="overflow-x-auto border rounded-lg bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-600">
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} className={"px-4 py-3 " + (col.className ?? "")}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-6 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t">
                {columns.map((col) => {
                  const value = row[col.key];
                  return (
                    <td
                      key={String(col.key)}
                      className={"px-4 py-3 " + (col.className ?? "")}
                    >
                      {col.render ? col.render(value, row) : (value as React.ReactNode)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
