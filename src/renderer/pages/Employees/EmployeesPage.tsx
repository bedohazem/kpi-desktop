import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { Department, Employee } from '../../types/api';
import { toast } from '../../utils/toast';
import * as XLSX from 'xlsx-js-style';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  flattenDepartmentTree,
  getDepartmentAndDescendantIds,
  sortEmployeeListByDepartmentTree,
} from '../../utils/departments-tree';

export default function EmployeesPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [employeeName, setEmployeeName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [qualification, setQualification] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [employeeSortOrder, setEmployeeSortOrder] = useState('');
  const [employeeDepartmentId, setEmployeeDepartmentId] = useState('');
  const [employeeNotes, setEmployeeNotes] = useState('');
  const [employeeActive, setEmployeeActive] = useState(true);

  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('');
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [employeeExportFormat, setEmployeeExportFormat] = useState<
    'pdf' | 'excel'
  >('pdf');
  const [isExportingEmployees, setIsExportingEmployees] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(
    null,
  );
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(
    null,
  );
  const [showInactiveEmployees, setShowInactiveEmployees] = useState(false);
  const [pinEmployeeHeader, setPinEmployeeHeader] = useState(() => {
    return localStorage.getItem('pinEmployeeHeader') !== 'false';
  });
  const employeeFormRef = useRef<HTMLElement | null>(null);
  const employeeNameInputRef = useRef<HTMLInputElement | null>(null);

  const departmentOptions = useMemo(
    () => flattenDepartmentTree(departments),
    [departments],
  );

  const selectedEmployeeDepartmentIds = useMemo(() => {
    if (!employeeDepartmentFilter) {
      return null;
    }

    return new Set(
      getDepartmentAndDescendantIds(
        departments,
        Number(employeeDepartmentFilter),
      ),
    );
  }, [departments, employeeDepartmentFilter]);

  async function loadEmployees(): Promise<void> {
    const rows = await window.api.employees.list({
      includeInactive: showInactiveEmployees,
    });

    setEmployees(rows);
  }

  async function saveEmployee(): Promise<void> {
    if (!employeeName.trim()) {
      toast.error('اكتب اسم الموظف');
      return;
    }

    const cleanNationalId = nationalId.trim();

    if (!/^\d{14}$/.test(cleanNationalId)) {
      toast.error('الرقم القومي لازم يكون 14 رقم بالظبط');
      return;
    }

    try {
      setIsSavingEmployee(true);

      if (editingEmployeeId) {
        await window.api.employees.update({
          id: editingEmployeeId,
          name: employeeName,
          national_id: cleanNationalId,
          qualification,
          job_title: jobTitle,
          department_id: employeeDepartmentId
            ? Number(employeeDepartmentId)
            : null,
          sort_order: employeeSortOrder ? Number(employeeSortOrder) : 0,
          notes: employeeNotes,
          active: employeeActive,
        });

        toast.success('تم تعديل بيانات الموظف بنجاح');
      } else {
        await window.api.employees.create({
          name: employeeName,
          national_id: cleanNationalId,
          qualification,
          job_title: jobTitle,
          department_id: employeeDepartmentId
            ? Number(employeeDepartmentId)
            : null,
          sort_order: employeeSortOrder ? Number(employeeSortOrder) : 0,
          notes: employeeNotes,
          active: employeeActive,
        });

        toast.success('تم حفظ الموظف بنجاح');
      }

      resetEmployeeForm();
      await loadEmployees();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ الموظف';
      toast.error(errorMessage);
    } finally {
      setIsSavingEmployee(false);
    }
  }

  const filteredEmployees = useMemo(() => {
    const searchText = employeeSearch.trim().toLowerCase();

    const matchingEmployees = employees.filter((employee) => {
      const matchesSearch =
        !searchText ||
        employee.name.toLowerCase().includes(searchText) ||
        (employee.national_id || '').toLowerCase().includes(searchText);

      const matchesDepartment =
        !selectedEmployeeDepartmentIds ||
        (employee.department_id !== null &&
          selectedEmployeeDepartmentIds.has(employee.department_id));

      return matchesSearch && matchesDepartment;
    });

    return sortEmployeeListByDepartmentTree(matchingEmployees, departments);
  }, [employees, departments, employeeSearch, selectedEmployeeDepartmentIds]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      window.api.departments.list(),
      window.api.employees.list({
        includeInactive: showInactiveEmployees,
      }),
    ])
      .then(([departmentRows, employeeRows]) => {
        if (isMounted) {
          setDepartments(departmentRows);
          setEmployees(employeeRows);
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('حدث خطأ أثناء تحميل بيانات الموظفين');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [showInactiveEmployees]);

  useEffect(() => {
    localStorage.setItem('pinEmployeeHeader', String(pinEmployeeHeader));
  }, [pinEmployeeHeader]);

  function resetEmployeeForm(): void {
    setEditingEmployeeId(null);
    setEmployeeName('');
    setNationalId('');
    setQualification('');
    setJobTitle('');
    setEmployeeDepartmentId('');
    setEmployeeNotes('');
    setEmployeeActive(true);
    setEmployeeSortOrder('');
  }

  function startEditEmployee(employee: Employee): void {
    setEditingEmployeeId(employee.id);
    setEmployeeName(employee.name);
    setNationalId(employee.national_id || '');
    setQualification(employee.qualification || '');
    setJobTitle(employee.job_title || '');
    setEmployeeDepartmentId(
      employee.department_id ? String(employee.department_id) : '',
    );
    setEmployeeNotes(employee.notes || '');
    setEmployeeActive(Boolean(employee.active));
    setEmployeeSortOrder(
      employee.sort_order > 0 ? String(employee.sort_order) : '',
    );
    toast.info('تعديل بيانات الموظف');

    requestAnimationFrame(() => {
      employeeFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      window.setTimeout(() => {
        employeeNameInputRef.current?.focus();
        employeeNameInputRef.current?.select();
      }, 350);
    });
  }

  async function toggleEmployeeActive(employee: Employee): Promise<void> {
    const nextActive = !employee.active;

    try {
      await window.api.employees.setActive({
        id: employee.id,
        active: nextActive,
      });

      toast.success(nextActive ? 'تم تفعيل الموظف' : 'تم تعطيل الموظف');
      await loadEmployees();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء تغيير حالة الموظف';
      toast.error(errorMessage);
    }
  }

  async function confirmDeleteEmployee(): Promise<void> {
    if (!employeeToDelete) {
      return;
    }

    try {
      await window.api.employees.delete({
        id: employeeToDelete.id,
      });

      toast.success('تم حذف الموظف بنجاح');

      if (editingEmployeeId === employeeToDelete.id) {
        resetEmployeeForm();
      }

      setEmployeeToDelete(null);
      await loadEmployees();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ أثناء حذف الموظف';
      toast.error(errorMessage);
    }
  }

  function escapeEmployeeExportHtml(
    value: string | number | null | undefined,
  ): string {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function exportEmployees(status: 'active' | 'inactive'): Promise<void> {
    if (isExportingEmployees) return;

    const isActive = status === 'active';
    const title = isActive ? 'كشف الموظفين المفعلين' : 'كشف الموظفين المعطلين';
    const fileName = isActive ? 'Active_Employees' : 'Inactive_Employees';

    try {
      setIsExportingEmployees(true);

      // جلب جميع الموظفين بصرف النظر عن فلتر الشاشة
      const allEmployees = await window.api.employees.list({
        includeInactive: true,
      });

      const exportDepartments = await window.api.departments.list({
        includeInactive: true,
      });

      const selectedEmployees = sortEmployeeListByDepartmentTree(
        allEmployees.filter((employee) =>
          isActive ? employee.active === 1 : employee.active !== 1,
        ),
        exportDepartments,
      );

      if (selectedEmployees.length === 0) {
        toast.warning('لا يوجد موظفون في هذه القائمة');
        return;
      }

      // تصدير Excel
      if (employeeExportFormat === 'excel') {
        const excelRows = selectedEmployees.map((employee, index) => ({
          م: index + 1,
          'اسم الموظف': employee.name,
          'الرقم القومي': employee.national_id || '',
          المؤهل: employee.qualification || '',
          الوظيفة: employee.job_title || '',
          الإدارة: employee.department_name || 'بدون إدارة',
          ملاحظات: employee.notes || '',
        }));

        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.json_to_sheet(excelRows);

        // جعل ورقة Excel من اليمين إلى الشمال
        workbook.Workbook = {
          Views: [{ RTL: true }],
        };

        // عرض الأعمدة السبعة بعد حذف الترتيب والحالة
        sheet['!cols'] = [
          { wch: 7 }, // م
          { wch: 40 }, // اسم الموظف
          { wch: 25 }, // الرقم القومي
          { wch: 28 }, // المؤهل
          { wch: 28 }, // الوظيفة
          { wch: 30 }, // الإدارة
          { wch: 55 }, // ملاحظات
        ];

        // ارتفاع الصفوف مع مراعاة الملاحظات متعددة الأسطر
        sheet['!rows'] = [
          { hpt: 34 },
          ...selectedEmployees.map((employee) => ({
            hpt: Math.max(
              34,
              Math.min(160, (employee.notes?.split(/\r?\n/).length || 1) * 28),
            ),
          })),
        ];

        // تنسيق جميع الخلايا
        if (sheet['!ref']) {
          const range = XLSX.utils.decode_range(sheet['!ref']);

          for (let row = range.s.r; row <= range.e.r; row++) {
            for (let col = range.s.c; col <= range.e.c; col++) {
              const address = XLSX.utils.encode_cell({
                r: row,
                c: col,
              });

              const cell = sheet[address];
              if (!cell) continue;

              cell.s = {
                font: {
                  name: 'Arial',
                  sz: 16,
                  bold: row === 0,
                  color: { rgb: '111827' },
                },
                alignment: {
                  horizontal: 'center',
                  vertical: 'center',
                  wrapText: true,
                },
                border: {
                  bottom: {
                    style: 'thin',
                    color: { rgb: 'D1D5DB' },
                  },
                },
                ...(row === 0
                  ? {
                      fill: {
                        fgColor: { rgb: 'DCEAF7' },
                      },
                    }
                  : {}),
              };
            }
          }
        }

        XLSX.utils.book_append_sheet(workbook, sheet, 'الموظفون');

        XLSX.writeFile(workbook, `${fileName}.xlsx`, {
          cellStyles: true,
        });

        toast.success('تم تصدير ملف Excel');
        return;
      }

      // تصدير PDF
      const rowsHtml = selectedEmployees
        .map(
          (employee, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeEmployeeExportHtml(employee.name)}</td>
        <td dir="ltr">${escapeEmployeeExportHtml(employee.national_id || '-')}</td>
        <td>${escapeEmployeeExportHtml(employee.qualification || '-')}</td>
        <td>${escapeEmployeeExportHtml(employee.job_title || '-')}</td>
        <td>${escapeEmployeeExportHtml(employee.department_name || 'بدون إدارة')}</td>
        <td class="notes">${escapeEmployeeExportHtml(employee.notes || '-')}</td>
      </tr>
    `,
        )
        .join('');

      const html = `
      <!doctype html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }

          body {
            font-family: Tahoma, Arial, sans-serif;
            direction: rtl;
            color: #111827;
            background: white;
          }

          h1 {
            text-align: center;
            font-size: 20px;
            margin-bottom: 12px;
          }

          .info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 14px;
            font-size: 12px;
            font-weight: bold;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            border: 1px solid #777;
            padding: 6px 3px;
            font-size: 9px;
            line-height: 1.4;
            text-align: center;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }

          th {
            background: #e5e7eb;
            font-weight: bold;
          }

          .notes {
            white-space: pre-line;
            text-align: center;
          }

          thead {
            display: table-header-group;
          }

          tbody tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>

        <div class="info">
          <span>عدد الموظفين: ${selectedEmployees.length}</span>
          <span>تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</span>
        </div>

        <table>
          <colgroup>
            <col style="width: 3%" />
            <col style="width: 15%" />
            <col style="width: 14%" />
            <col style="width: 11%" />
            <col style="width: 12%" />
            <col style="width: 12%" />
            <col style="width: 6%" />
            <col style="width: 7%" />
            <col style="width: 20%" />
          </colgroup>
          <thead>
            <tr>
              <th>م</th>
              <th>اسم الموظف</th>
              <th>الرقم القومي</th>
              <th>المؤهل</th>
              <th>الوظيفة</th>
              <th>الإدارة</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

      const result = await window.api.reports.savePdf({
        html,
        fileName: `${fileName}.pdf`,
      });

      if (result.canceled) {
        toast.info('تم إلغاء حفظ PDF');
        return;
      }

      toast.success('تم حفظ ملف PDF بنجاح');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'حدث خطأ أثناء التصدير';

      toast.error(message);
    } finally {
      setIsExportingEmployees(false);
    }
  }

  return (
    <>
      <section
        ref={employeeFormRef}
        className={`card ${pinEmployeeHeader ? 'sticky-entry-card' : ''}`}
      >
        <h2>{editingEmployeeId ? 'تعديل بيانات الموظف' : 'إضافة موظف'}</h2>

        <div className="form-grid">
          <label>
            اسم الموظف
            <input
              ref={employeeNameInputRef}
              value={employeeName}
              onChange={(event) => setEmployeeName(event.target.value)}
            />
          </label>

          <label>
            الرقم القومي
            <input
              value={nationalId}
              inputMode="numeric"
              maxLength={14}
              onChange={(event) => {
                const onlyNumbers = event.target.value
                  .replace(/\D/g, '')
                  .slice(0, 14);
                setNationalId(onlyNumbers);
              }}
            />
          </label>

          <label>
            المؤهل
            <input
              value={qualification}
              onChange={(event) => setQualification(event.target.value)}
            />
          </label>

          <label>
            الوظيفة
            <input
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
            />
          </label>

          <label>
            الترتيب داخل الإدارة
            <input
              value={employeeSortOrder}
              inputMode="numeric"
              placeholder="1 للمدير، 2 للنائب..."
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '');
                setEmployeeSortOrder(value);
              }}
            />
          </label>

          <label>
            الإدارة
            <select
              value={employeeDepartmentId}
              onChange={(event) => setEmployeeDepartmentId(event.target.value)}
            >
              <option value="">بدون إدارة</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {'— '.repeat(department.level)}
                  {department.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            ملاحظات
            <textarea
              className="employee-notes-input"
              value={employeeNotes}
              rows={4}
              placeholder="اكتب الملاحظات... استخدم Enter أو Shift + Enter لسطر جديد"
              onChange={(event) => setEmployeeNotes(event.target.value)}
            />
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={employeeActive}
              onChange={(event) => setEmployeeActive(event.target.checked)}
            />
            موظف نشط
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={pinEmployeeHeader}
              onChange={(event) => setPinEmployeeHeader(event.target.checked)}
            />
            تثبيت بيانات الموظف أعلى الشاشة
          </label>
        </div>

        <button
          className="primary-button"
          disabled={isSavingEmployee}
          onClick={saveEmployee}
        >
          {isSavingEmployee
            ? 'جاري الحفظ...'
            : editingEmployeeId
              ? 'تعديل الموظف'
              : 'حفظ الموظف'}
        </button>

        {editingEmployeeId && (
          <button
            className="secondary-button"
            type="button"
            onClick={resetEmployeeForm}
          >
            إلغاء التعديل
          </button>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <h2>قائمة الموظفين</h2>
          <span>عدد النتائج: {filteredEmployees.length}</span>
        </div>

        <div className="form-grid">
          <label>
            بحث بالاسم أو الرقم القومي
            <input
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
            />
          </label>

          <label>
            فلتر الإدارة
            <select
              value={employeeDepartmentFilter}
              onChange={(event) =>
                setEmployeeDepartmentFilter(event.target.value)
              }
            >
              <option value="">كل الإدارات</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="checkbox-label inline-checkbox">
          <input
            type="checkbox"
            checked={showInactiveEmployees}
            onChange={(event) => setShowInactiveEmployees(event.target.checked)}
          />
          إظهار غير المفعلين
        </label>

        <div
          className="actions-row"
          style={{ alignItems: 'end', marginBottom: 16 }}
        >
          <label style={{ minWidth: 150 }}>
            صيغة التصدير
            <select
              value={employeeExportFormat}
              onChange={(event) =>
                setEmployeeExportFormat(event.target.value as 'pdf' | 'excel')
              }
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </label>

          <button
            className="primary-button"
            disabled={isExportingEmployees}
            onClick={() => void exportEmployees('active')}
          >
            تصدير الموظفين المفعلين
          </button>

          <button
            className="secondary-button"
            disabled={isExportingEmployees}
            onClick={() => void exportEmployees('inactive')}
          >
            تصدير الموظفين المعطلين
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الرقم القومي</th>
              <th>المؤهل</th>
              <th>الوظيفة</th>
              <th>الإدارة</th>
              <th>الترتيب</th>
              <th>الحالة</th>
              <th>ملاحظات</th>
              <th>إجراءات</th>
            </tr>
          </thead>

          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={9}>لا توجد موظفين مطابقين للبحث</td>
              </tr>
            ) : (
              filteredEmployees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.name}</td>
                  <td>{employee.national_id || '-'}</td>
                  <td>{employee.qualification || '-'}</td>
                  <td>{employee.job_title || '-'}</td>
                  <td>{employee.department_name || '-'}</td>
                  <td>{employee.sort_order > 0 ? employee.sort_order : '-'}</td>
                  <td>{employee.active ? 'نشط' : 'غير نشط'}</td>
                  <td className="multiline-notes">{employee.notes || '-'}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="small-button"
                        onClick={() => startEditEmployee(employee)}
                      >
                        تعديل
                      </button>

                      <button
                        className={
                          employee.active
                            ? 'small-button danger'
                            : 'small-button success'
                        }
                        onClick={() => toggleEmployeeActive(employee)}
                      >
                        {employee.active ? 'تعطيل' : 'تفعيل'}
                      </button>
                      <button
                        className="small-button danger"
                        onClick={() => setEmployeeToDelete(employee)}
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={Boolean(employeeToDelete)}
        title="حذف موظف"
        message={`هل تريد حذف الموظف "${employeeToDelete?.name || ''}" نهائيًا؟ سيتم حذف تقييماته القديمة أيضًا.`}
        confirmText="حذف نهائي"
        cancelText="إلغاء"
        danger
        onConfirm={() => {
          void confirmDeleteEmployee();
        }}
        onCancel={() => setEmployeeToDelete(null)}
      />
    </>
  );
}
