import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { Department, Employee, ReportsResult } from '../../types/api';
import * as XLSX from 'xlsx-js-style';
import { toast } from '../../utils/toast';
import {
  flattenDepartmentTree,
  sortDepartmentSummaryByTree,
  sortEmployeesByDepartmentTree,
  sortEmployeeListByDepartmentTree,
} from '../../utils/departments-tree';

function normalizeEmployeeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
}

const currentYear = new Date().getFullYear();

export default function ReportsPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [year, setYear] = useState(String(currentYear));
  const [fromMonth, setFromMonth] = useState('1');
  const [toMonth, setToMonth] = useState('12');
  const [departmentId, setDepartmentId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const [highlightedEmployeeIndex, setHighlightedEmployeeIndex] = useState(0);
  const [report, setReport] = useState<ReportsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const departmentOptions = useMemo(
    () => flattenDepartmentTree(departments),
    [departments],
  );

  const filteredEmployees = useMemo(() => {
    const ordered = sortEmployeeListByDepartmentTree(employees, departments);

    const query = normalizeEmployeeSearch(employeeSearch);

    if (!query) return ordered;

    return ordered.filter((employee) =>
      normalizeEmployeeSearch(employee.name).includes(query),
    );
  }, [employees, departments, employeeSearch]);

  function selectReportEmployee(employee: Employee | null): void {
    setEmployeeId(employee ? String(employee.id) : '');
    setEmployeeSearch(employee?.name || '');
    setEmployeeDropdownOpen(false);
    setHighlightedEmployeeIndex(0);
    setReport(null);
  }

  const orderedReportEmployees = useMemo(() => {
    if (!report) {
      return [];
    }

    return sortEmployeesByDepartmentTree(report.employees, departments);
  }, [report, departments]);

  function getEmployeeDifference(
    employee: ReportsResult['employees'][number],
  ): number | null {
    if (!report || report.months.length < 2) {
      return null;
    }

    const firstMonth = report.months[0];
    const lastMonth = report.months[report.months.length - 1];

    const firstValue = employee.month_values[String(firstMonth)];
    const lastValue = employee.month_values[String(lastMonth)];

    if (typeof firstValue !== 'number' || typeof lastValue !== 'number') {
      return null;
    }

    return lastValue - firstValue;
  }

  function formatDifference(value: number | null): string {
    if (value === null) {
      return '-';
    }

    const formatted = Number(value.toFixed(2));

    if (formatted > 0) {
      return `+${formatted}`;
    }

    return String(formatted);
  }

  const reportTotals = useMemo(() => {
    const monthTotals: Record<string, number> = {};

    if (!report) {
      return {
        monthTotals,
        grandTotal: 0,
        overallDifference: null as number | null,
      };
    }

    for (const reportMonth of report.months) {
      monthTotals[String(reportMonth)] = orderedReportEmployees.reduce(
        (sum, employee) => {
          const value = employee.month_values[String(reportMonth)];
          return sum + (typeof value === 'number' ? value : 0);
        },
        0,
      );
    }

    const grandTotal = Object.values(monthTotals).reduce(
      (sum, value) => sum + value,
      0,
    );

    let overallDifference: number | null = null;

    if (report.months.length >= 2) {
      const firstMonth = report.months[0];
      const lastMonth = report.months[report.months.length - 1];

      overallDifference =
        monthTotals[String(lastMonth)] - monthTotals[String(firstMonth)];
    }

    return {
      monthTotals,
      grandTotal,
      overallDifference,
    };
  }, [report, orderedReportEmployees]);

  const orderedDepartmentSummary = useMemo(() => {
    if (!report) {
      return [];
    }

    return sortDepartmentSummaryByTree(report.departmentSummary, departments);
  }, [report, departments]);

  function getDepartmentDifference(
    department: ReportsResult['departmentSummary'][number],
  ): number | null {
    if (!report || report.months.length < 2) {
      return null;
    }

    return department.last_month_total - department.first_month_total;
  }

  function getEmployeeHistory(
    employee: ReportsResult['employees'][number],
  ): string {
    if (!report) return '';

    type HistorySegment = {
      from: number;
      to: number;
      departmentId: number | null;
      department: string;
      jobTitle: string;
    };

    const segments: HistorySegment[] = [];

    for (const month of report.months) {
      const assignment = employee.month_assignments[String(month)];

      // الشهر غير المقيم لا نعتبره فترة عمل مؤكدة
      if (!assignment) continue;

      const department = assignment.department_name || 'بدون إدارة';
      const jobTitle = assignment.job_title || 'الوظيفة غير مسجلة';

      const previous = segments[segments.length - 1];

      if (
        previous &&
        previous.to === month - 1 &&
        previous.departmentId === assignment.department_id &&
        previous.jobTitle === jobTitle
      ) {
        previous.to = month;
        continue;
      }

      segments.push({
        from: month,
        to: month,
        departmentId: assignment.department_id,
        department,
        jobTitle,
      });
    }

    if (segments.length === 0) {
      return 'لا توجد تقييمات محفوظة في الفترة';
    }

    return segments
      .map((segment) => {
        const period =
          segment.from === segment.to
            ? `شهر ${segment.from}`
            : `شهر ${segment.from}–${segment.to}`;

        return `${period}: ${segment.department} / ${segment.jobTitle}`;
      })
      .join(' | ');
  }

  async function generateReport(): Promise<void> {
    if (employeeSearch.trim() && !employeeId) {
      toast.warning(
        'اختار موظف من نتائج البحث، أو امسح الاسم لعرض كل الموظفين',
      );
      return;
    }
    toast.info('جاري انشاء تقرير ...');

    try {
      setIsLoading(true);
      setReport(null);

      const result = await window.api.reports.generate({
        year: Number(year),
        from_month: Number(fromMonth),
        to_month: Number(toMonth),
        department_id: departmentId ? Number(departmentId) : null,
        employee_id: employeeId ? Number(employeeId) : null,
      });

      setReport(result);
      toast.success('تم إنشاء التقرير');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء التقرير';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      window.api.departments.list({ includeInactive: true }),
      window.api.employees.list({ includeInactive: true }),
    ])
      .then(([departmentRows, employeeRows]) => {
        if (isMounted) {
          setDepartments(departmentRows);
          setEmployees(employeeRows);
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('حدث خطأ أثناء تحميل بيانات التقرير');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function exportReportToExcel(): void {
    if (!report) {
      toast.warning('اعرض التقرير الأول قبل التصدير');
      return;
    }

    const employeeRows = orderedReportEmployees.map((employee, index) => {
      const row: Record<string, string | number> = {
        م: index + 1,
        'اسم الموظف': employee.employee_name,
        المؤهل: employee.qualification || '',
        'الإدارة الحالية': employee.department_name || '',
        'الوظيفة الحالية': employee.job_title || '',
        'حركة الإدارة والوظيفة': getEmployeeHistory(employee),
      };

      for (const reportMonth of report.months) {
        const value = employee.month_values[String(reportMonth)];
        row[`شهر ${reportMonth}`] = value === null ? '' : value;
      }

      const difference = getEmployeeDifference(employee);

      row['الإجمالي'] = Number(employee.total.toFixed(2));
      row['الفرق'] = difference === null ? '' : Number(difference.toFixed(2));
      row['ملاحظات'] = employee.notes || '';

      return row;
    });

    if (employeeRows.length > 0) {
      const totalExcelRow: Record<string, string | number> = {
        م: '',
        'اسم الموظف': 'الإجمالي',
        المؤهل: '',
        'الإدارة الحالية': '',
        'الوظيفة الحالية': '',
        'حركة الإدارة والوظيفة': '',
      };

      for (const reportMonth of report.months) {
        totalExcelRow[`شهر ${reportMonth}`] = Number(
          reportTotals.monthTotals[String(reportMonth)].toFixed(2),
        );
      }

      totalExcelRow['الإجمالي'] = Number(reportTotals.grandTotal.toFixed(2));

      totalExcelRow['الفرق'] =
        reportTotals.overallDifference === null
          ? ''
          : Number(reportTotals.overallDifference.toFixed(2));
      totalExcelRow['ملاحظات'] = '';

      employeeRows.push(totalExcelRow);
    }

    const departmentRows = orderedDepartmentSummary.map((department) => {
      const difference = getDepartmentDifference(department);

      return {
        الإدارة: department.department_name,
        'عدد الموظفين': department.employees_count,
        'عدد التقييمات': department.evaluations_count,
        الإجمالي: Number(department.total.toFixed(2)),
        الفرق: difference === null ? '' : Number(difference.toFixed(2)),
      };
    });

    const historyRows: (string | number)[][] = [
      [
        'اسم الموظف',
        'السنة',
        'الشهر',
        'الإدارة وقت التقييم',
        'الوظيفة وقت التقييم',
        'درجة التقييم',
      ],
    ];

    for (const employee of orderedReportEmployees) {
      for (const reportMonth of report.months) {
        const monthKey = String(reportMonth);
        const score = employee.month_values[monthKey];
        const assignment = employee.month_assignments[monthKey];

        if (typeof score !== 'number' || !assignment) {
          continue;
        }

        historyRows.push([
          employee.employee_name,
          Number(year),
          reportMonth,
          assignment.department_name || 'بدون إدارة',
          assignment.job_title || 'الوظيفة غير مسجلة',
          Number(score.toFixed(2)),
        ]);
      }
    }

    const workbook = XLSX.utils.book_new();

    // نفس اتجاه ملف الموظفين: من اليمين إلى الشمال
    workbook.Workbook = {
      Views: [{ RTL: true }],
    };

    const employeesSheet = XLSX.utils.json_to_sheet(employeeRows);
    const departmentsSheet = XLSX.utils.json_to_sheet(departmentRows);
    const historySheet = XLSX.utils.aoa_to_sheet(historyRows);

    // تنسيق موحد وهادئ لكل أوراق التقرير
    function styleReportSheet(
      sheet: ReturnType<typeof XLSX.utils.json_to_sheet>,
      widths: number[],
      options: {
        totalRow?: boolean;
        wrapColumns?: number[];
      } = {},
    ): void {
      if (!sheet['!ref']) return;

      const range = XLSX.utils.decode_range(sheet['!ref']);

      // عرض كل عمود
      sheet['!cols'] = widths.map((width) => ({
        wch: width,
      }));

      // ارتفاع الصفوف حسب طول المحتوى
      sheet['!rows'] = Array.from({ length: range.e.r + 1 }, (_, row) => {
        if (row === 0) return { hpt: 42 };

        if (options.totalRow && row === range.e.r) {
          return { hpt: 40 };
        }

        let maxLines = 1;

        for (const col of options.wrapColumns || []) {
          const address = XLSX.utils.encode_cell({
            r: row,
            c: col,
          });

          const value = String(sheet[address]?.v ?? '');
          const charsPerLine = Math.max(14, widths[col] - 6);

          const lines = value
            .split(/\r?\n/)
            .reduce(
              (sum, line) =>
                sum + Math.max(1, Math.ceil(line.length / charsPerLine)),
              0,
            );

          maxLines = Math.max(maxLines, lines);
        }

        return {
          hpt: Math.min(180, Math.max(36, maxLines * 22 + 12)),
        };
      });

      // فلترة وترتيب البيانات من عنوان الجدول
      const filterLastRow = options.totalRow ? range.e.r - 1 : range.e.r;

      if (filterLastRow >= 1) {
        sheet['!autofilter'] = {
          ref: XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: filterLastRow, c: range.e.c },
          }),
        };
      }

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const address = XLSX.utils.encode_cell({
            r: row,
            c: col,
          });

          const cell = sheet[address];
          if (!cell) continue;

          const isHeader = row === 0;
          const isTotal = options.totalRow === true && row === range.e.r;

          cell.s = {
            font: {
              name: 'Arial',
              sz: isHeader ? 15 : 14,
              bold: isHeader || isTotal,
              color: { rgb: '111827' },
            },

            alignment: {
              horizontal:
                !isHeader && options.wrapColumns?.includes(col)
                  ? 'right'
                  : 'center',
              vertical: 'center',
              wrapText: true,
            },

            border: {
              bottom: {
                style: 'thin',
                color: { rgb: 'D1D5DB' },
              },
              right: {
                style: 'thin',
                color: { rgb: 'E5E7EB' },
              },
            },

            ...(isHeader
              ? {
                  fill: {
                    fgColor: { rgb: 'DCEAF7' },
                  },
                }
              : isTotal
                ? {
                    fill: {
                      fgColor: { rgb: 'EDF3FA' },
                    },
                  }
                : {}),

            ...(cell.t === 'n'
              ? {
                  numFmt: Number.isInteger(Number(cell.v)) ? '0' : '0.00',
                }
              : {}),
          };
        }
      }
    }

    // الشيت الأول: تقرير الموظفين
    styleReportSheet(
      employeesSheet,
      [
        7, // م
        34, // اسم الموظف
        24, // المؤهل
        28, // الإدارة الحالية
        28, // الوظيفة الحالية
        68, // حركة الإدارة والوظيفة
        ...report.months.map(() => 15), // الشهور
        18, // الإجمالي
        16, // الفرق
        42, // ملاحظات
      ],
      {
        totalRow: employeeRows.length > 0,
        wrapColumns: [1, 3, 4, 5, 9 + report.months.length],
      },
    );

    // الشيت الثاني: ملخص الإدارات
    styleReportSheet(
      departmentsSheet,
      [
        38, // الإدارة
        22, // عدد الموظفين
        22, // عدد التقييمات
        20, // الإجمالي
        18, // الفرق
      ],
      {
        wrapColumns: [0],
      },
    );

    // الشيت الثالث: تاريخ التقييمات
    styleReportSheet(
      historySheet,
      [
        36, // اسم الموظف
        18, // السنة
        16, // الشهر
        38, // الإدارة وقت التقييم
        38, // الوظيفة وقت التقييم
        22, // درجة التقييم
      ],
      {
        wrapColumns: [0, 3, 4],
      },
    );

    XLSX.utils.book_append_sheet(workbook, employeesSheet, 'تقرير الموظفين');

    XLSX.utils.book_append_sheet(workbook, departmentsSheet, 'ملخص الإدارات');

    XLSX.utils.book_append_sheet(workbook, historySheet, 'تاريخ التقييمات');

    const fileName = `KPI_Report_${year}_${fromMonth}_to_${toMonth}.xlsx`;

    XLSX.writeFile(workbook, fileName, {
      cellStyles: true,
    });
  }

  function escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatNumber(value: number | null): string {
    if (value === null) {
      return '-';
    }

    return Number(value)
      .toFixed(2)
      .replace(/\\.00$/, '');
  }

  function buildReportPdfHtml(): string {
    if (!report) {
      return '';
    }

    const monthHeaders = report.months
      .map((monthNumber) => `<th>شهر<br>${monthNumber}</th>`)
      .join('');

    const monthColumnWidth = Math.min(6, 40 / report.months.length);

    const monthColumns = report.months
      .map(() => `<col style="width: ${monthColumnWidth}%" />`)
      .join('');

    const employeeRows = orderedReportEmployees
      .map((employee, index) => {
        const monthCells = report.months
          .map((monthNumber) => {
            const value = employee.month_values[String(monthNumber)];
            return `<td>${value === null ? '-' : formatNumber(value)}</td>`;
          })
          .join('');

        const difference = getEmployeeDifference(employee);

        return `
        <tr>
          <td>${index + 1}</td>
          <td class="text-cell">
            ${escapeHtml(employee.employee_name)}
            <div class="history-note">
              ${escapeHtml(getEmployeeHistory(employee)).replaceAll(' | ', '\n')}
            </div>
          </td>
          <td class="text-cell">${escapeHtml(employee.qualification || '-')}</td>
          <td class="text-cell">${escapeHtml(employee.department_name || '-')}</td>
          <td class="text-cell">${escapeHtml(employee.job_title || '-')}</td>
          ${monthCells}
          <td>${formatNumber(employee.total)}</td>
          <td>${formatDifference(difference)}</td>
          <td class="text-cell multiline-notes">${escapeHtml(employee.notes || '-')}</td>
        </tr>
      `;
      })
      .join('');

    const totalRow =
      orderedReportEmployees.length > 0
        ? `
        <tr class="total-row">
          <td colspan="5">الإجمالي</td>

          ${report.months
            .map(
              (reportMonth) =>
                `<td>${formatNumber(
                  reportTotals.monthTotals[String(reportMonth)],
                )}</td>`,
            )
            .join('')}

          <td>${formatNumber(reportTotals.grandTotal)}</td>
          <td>${formatDifference(reportTotals.overallDifference)}</td>
          <td>-</td>
        </tr>
      `
        : '';

    const summaryRows = orderedDepartmentSummary
      .map(
        (department) => `
        <tr>
          <td class="text-cell">${escapeHtml(department.department_name)}</td>
          <td>${department.employees_count}</td>
          <td>${department.evaluations_count}</td>
          <td>${formatNumber(department.total)}</td>
          <td>${formatDifference(getDepartmentDifference(department))}</td>
        </tr>
      `,
      )
      .join('');

    return `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير التقييمات</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: white;
            color: #111;
            font-family: Tahoma, Arial, sans-serif;
            direction: rtl;
          }

          .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 8px;
            border-bottom: 2px solid #111;
            padding-bottom: 6px;
          }

          h1 {
            margin: 0;
            font-size: 18px;
          }

          .meta {
            font-size: 10px;
            line-height: 1.7;
            text-align: left;
            direction: rtl;
          }

          h2 {
            margin: 10px 0 6px;
            font-size: 13px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            margin-bottom: 10px;
          }

          th,
          td {
            border: 1px solid #333;
            padding: 3px 2px;
            font-size: 8.3px;
            line-height: 1.25;
            text-align: center;
            vertical-align: middle;
            color: #111;
            overflow-wrap: anywhere;
          }

          th {
            background: #e5e7eb;
            font-weight: 700;
          }

          .text-cell {
            text-align: right;
            font-size: 8px;
          }

          .multiline-notes {
            white-space: pre-line;
          }

          .history-note {
            margin-top: 4px;
            font-size: 7px;
            line-height: 1.5;
            color: #555;
            white-space: pre-line;
          }

          .summary-table th,
          .summary-table td {
            font-size: 10px;
            padding: 5px;
          }

          .no-data {
            text-align: center;
            padding: 20px;
            font-size: 13px;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <h1>تقرير التقييمات الشهرية</h1>
          </div>

          <div class="meta">
            السنة: ${escapeHtml(year)}<br />
            من شهر: ${escapeHtml(fromMonth)} إلى شهر: ${escapeHtml(toMonth)}<br />
            تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}
          </div>
        </div>

        <h2>ملخص الإدارات</h2>

        <table class="summary-table">
          <thead>
            <tr>
              <th>الإدارة</th>
              <th>عدد الموظفين</th>
              <th>عدد التقييمات</th>
              <th>الإجمالي</th>
              <th>الفرق</th>
            </tr>
          </thead>

          <tbody>
            ${summaryRows || '<tr><td class="no-data" colspan="5">لا توجد بيانات</td></tr>'}
          </tbody>
        </table>

        <h2>تقرير الموظفين</h2>

        <p style="font-size: 9px; line-height: 1.6; margin: 4px 0 8px;">
          الإدارة والوظيفة الظاهرتان في الأعمدة هما البيانات الحالية للموظف.
          حركة الإدارات والوظائف المسجلة وقت التقييم موضحة تحت اسمه.
          تُحسب درجات كل إدارة وفق الإدارة المحفوظة مع تقييم الشهر.
        </p>

        <table>
          <colgroup>
            <col style="width: 3%" />
            <col style="width: 11%" />
            <col style="width: 9%" />
            <col style="width: 9%" />
            <col style="width: 9%" />
            ${monthColumns}
            <col style="width: 5%" />
            <col style="width: 5%" />
            <col style="width: 7.6%" />
          </colgroup>

          <thead>
            <tr>
              <th>م</th>
              <th>اسم الموظف</th>
              <th>المؤهل</th>
              <th>الإدارة الحالية</th>
              <th>الوظيفة الحالية</th>
              ${monthHeaders}
              <th>الإجمالي</th>
              <th>الفرق</th>
              <th>ملاحظات</th>
            </tr>
          </thead>

          <tbody>
            ${
              employeeRows
                ? `${employeeRows}${totalRow}`
                : `<tr><td class="no-data" colspan="${report.months.length + 8}">لا توجد بيانات</td></tr>`
            }
          </tbody>
        </table>
      </body>
    </html>
  `;
  }

  async function exportReportToPdf(): Promise<void> {
    if (!report) {
      toast.info('اعرض التقرير الأول قبل حفظ PDF');
      return;
    }

    try {
      const result = await window.api.reports.savePdf({
        html: buildReportPdfHtml(),
        fileName: `KPI_Report_${year}_${fromMonth}_to_${toMonth}.pdf`,
      });

      if (result.canceled) {
        toast.info('تم إلغاء حفظ PDF');
        return;
      }

      toast.success('تم حفظ ملف PDF بنجاح');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ PDF';
      toast.error(errorMessage);
    }
  }

  return (
    <>
      <section className="card">
        <h2>التقارير</h2>

        <div className="form-grid">
          <label>
            السنة
            <input
              disabled={isLoading}
              value={year}
              onChange={(event) => {
                setReport(null);
                setYear(event.target.value.replace(/\D/g, ''));
              }}
            />
          </label>

          <label>
            من شهر
            <select
              disabled={isLoading}
              value={fromMonth}
              onChange={(event) => {
                setReport(null);
                setFromMonth(event.target.value);
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            إلى شهر
            <select
              disabled={isLoading}
              value={toMonth}
              onChange={(event) => {
                setReport(null);
                setToMonth(event.target.value);
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            الإدارة
            <select
              disabled={isLoading}
              value={departmentId}
              onChange={(event) => {
                setReport(null);
                setDepartmentId(event.target.value);
                setEmployeeId('');
                setEmployeeSearch('');
                setEmployeeDropdownOpen(false);
                setHighlightedEmployeeIndex(0);
              }}
            >
              <option value="">كل الإدارات</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {'— '.repeat(department.level)}
                  {department.name}
                  {department.active !== 1 ? ' (معطّلة)' : ''}
                </option>
              ))}
            </select>
          </label>

          <div
            className="employee-search-field"
            onBlur={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              ) {
                setEmployeeDropdownOpen(false);
              }
            }}
          >
            <label htmlFor="report-employee-search">الموظف</label>

            <input
              id="report-employee-search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={employeeDropdownOpen}
              aria-controls="report-employee-results"
              autoComplete="off"
              disabled={isLoading}
              placeholder="كل الموظفين — اكتب اسم الموظف"
              value={employeeSearch}
              onFocus={(event) => {
                setEmployeeDropdownOpen(true);
                event.currentTarget.select();
              }}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setEmployeeId('');
                setReport(null);
                setHighlightedEmployeeIndex(0);
                setEmployeeDropdownOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setEmployeeDropdownOpen(false);
                  return;
                }

                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setEmployeeDropdownOpen(true);

                  const direction = event.key === 'ArrowDown' ? 1 : -1;

                  setHighlightedEmployeeIndex((index) =>
                    Math.max(
                      0,
                      Math.min(filteredEmployees.length - 1, index + direction),
                    ),
                  );
                }

                if (event.key === 'Enter') {
                  event.preventDefault();

                  const employee = filteredEmployees[highlightedEmployeeIndex];

                  if (employeeDropdownOpen && employee) {
                    selectReportEmployee(employee);
                  }
                }
              }}
            />

            {employeeDropdownOpen && !isLoading && (
              <div
                id="report-employee-results"
                role="listbox"
                className="employee-search-dropdown"
              >
                {!employeeSearch.trim() && (
                  <button
                    type="button"
                    className="employee-search-option"
                    onClick={() => selectReportEmployee(null)}
                  >
                    كل الموظفين
                  </button>
                )}

                {filteredEmployees.length === 0 ? (
                  <div className="employee-search-empty">
                    لا يوجد موظف مطابق للبحث
                  </div>
                ) : (
                  filteredEmployees.map((employee, index) => (
                    <button
                      key={employee.id}
                      type="button"
                      role="option"
                      aria-selected={employeeId === String(employee.id)}
                      className={`employee-search-option ${
                        highlightedEmployeeIndex === index ? 'highlighted' : ''
                      }`}
                      onMouseEnter={() => setHighlightedEmployeeIndex(index)}
                      onClick={() => selectReportEmployee(employee)}
                    >
                      <span>{employee.name}</span>
                      <small>
                        {employee.department_name || 'بدون إدارة'}
                        {employee.active !== 1 ? ' — معطّل' : ''}
                      </small>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="actions-row">
          <button
            className="primary-button"
            disabled={isLoading}
            onClick={generateReport}
          >
            {isLoading ? 'جاري إنشاء التقرير...' : 'عرض التقرير'}
          </button>

          <button
            className="secondary-button"
            disabled={!report || isLoading}
            onClick={exportReportToExcel}
          >
            تصدير Excel
          </button>

          <button
            className="secondary-button"
            disabled={!report || isLoading}
            onClick={exportReportToPdf}
          >
            حفظ PDF
          </button>
        </div>
      </section>

      {report && (
        <>
          <section className="card">
            <div className="section-header">
              <h2>ملخص الإدارات</h2>
              <span>عدد الإدارات: {orderedDepartmentSummary.length}</span>
            </div>

            <div className="report-summary-grid">
              {orderedDepartmentSummary.map((department) => (
                <div
                  className="summary-card"
                  key={String(department.department_id)}
                >
                  <h3>{department.department_name}</h3>
                  <p>عدد الموظفين: {department.employees_count}</p>
                  <p>عدد التقييمات: {department.evaluations_count}</p>
                  <p>الإجمالي: {department.total.toFixed(2)}</p>
                  <p>
                    الفرق:{' '}
                    {formatDifference(getDepartmentDifference(department))}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-header">
              <h2>تقرير الموظفين</h2>
              <span>عدد الموظفين: {orderedReportEmployees.length}</span>
            </div>

            <div className="table-wrapper report-table-wrapper">
              <table
                className={`report-employees-table ${
                  report.months.length <= 3
                    ? 'report-table-large'
                    : report.months.length <= 7
                      ? 'report-table-medium'
                      : 'report-table-compact'
                }`}
              >
                <colgroup>
                  <col style={{ width: '2.5%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '7%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />

                  {report.months.map((month) => (
                    <col
                      key={month}
                      style={{
                        width: `${Math.min(6, 40 / report.months.length)}%`,
                      }}
                    />
                  ))}

                  <col style={{ width: '5%' }} />
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '12.5%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>م</th>
                    <th>اسم الموظف</th>
                    <th>المؤهل</th>
                    <th>الإدارة الحالية</th>
                    <th>الوظيفة الحالية</th>
                    {report.months.map((month) => (
                      <th key={month}>شهر {month}</th>
                    ))}
                    <th>الإجمالي</th>
                    <th>الفرق</th>
                    <th>ملاحظات</th>
                  </tr>
                </thead>

                <tbody>
                  {report.employees.length === 0 ? (
                    <tr>
                      <td colSpan={report.months.length + 8}>
                        لا توجد بيانات في هذا التقرير
                      </td>
                    </tr>
                  ) : (
                    orderedReportEmployees.map((employee, index) => (
                      <tr key={employee.employee_id}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{employee.employee_name}</strong>

                          <small
                            style={{
                              display: 'block',
                              marginTop: 6,
                              fontSize: 12,
                              lineHeight: 1.6,
                              color: '#64748b',
                              whiteSpace: 'normal',
                            }}
                          >
                            {getEmployeeHistory(employee)}
                          </small>
                        </td>
                        <td>{employee.qualification || '-'}</td>
                        <td>{employee.department_name || '-'}</td>
                        <td>{employee.job_title || '-'}</td>

                        {report.months.map((month) => {
                          const monthKey = String(month);
                          const score = employee.month_values[monthKey];
                          const assignment =
                            employee.month_assignments[monthKey];

                          const details = assignment
                            ? `الإدارة: ${
                                assignment.department_name || 'بدون إدارة'
                              } | الوظيفة: ${
                                assignment.job_title || 'الوظيفة غير مسجلة'
                              }`
                            : 'لا يوجد تقييم محفوظ لهذا الشهر';

                          return (
                            <td key={month} title={details}>
                              {typeof score === 'number' ? score : '-'}
                            </td>
                          );
                        })}

                        <td>{employee.total.toFixed(2)}</td>
                        <td>
                          {formatDifference(getEmployeeDifference(employee))}
                        </td>
                        <td className="multiline-notes">
                          {employee.notes || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {orderedReportEmployees.length > 0 && (
                  <tfoot>
                    <tr className="report-total-row">
                      <td colSpan={5}>الإجمالي</td>

                      {report.months.map((reportMonth) => (
                        <td key={reportMonth}>
                          {reportTotals.monthTotals[
                            String(reportMonth)
                          ].toFixed(2)}
                        </td>
                      ))}

                      <td>{reportTotals.grandTotal.toFixed(2)}</td>
                      <td>
                        {formatDifference(reportTotals.overallDifference)}
                      </td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
