import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import type { Department, EvaluationEmployee } from '../../types/api';
import { toast } from '../../utils/toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import {
  flattenDepartmentTree,
  sortEmployeesByDepartmentTree,
} from '../../utils/departments-tree';

type EvaluationRowState = EvaluationEmployee & {
  evaluationValueInput: string;
  notesInput: string;
};

const currentDate = new Date();

export default function EvaluationsPage(): ReactElement {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rows, setRows] = useState<EvaluationRowState[]>([]);
  const [loadedScope, setLoadedScope] = useState<{
    month: number;
    year: number;
    department_id: number | null;
  } | null>(null);

  const loadGenerationRef = useRef(0);
  const pendingScopeToastRef = useRef(false);
  const [month, setMonth] = useState(String(currentDate.getMonth() + 1));
  const [year, setYear] = useState(String(currentDate.getFullYear()));
  const [departmentId, setDepartmentId] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [evaluationSearch, setEvaluationSearch] = useState('');
  const [showMissingOnly, setShowMissingOnly] = useState(false);
  const [activeEvaluationEmployeeId, setActiveEvaluationEmployeeId] = useState<
    number | null
  >(null);
  const evaluationInputRefs = useRef<Record<number, HTMLInputElement | null>>(
    {},
  );
  const [copyTarget, setCopyTarget] = useState<{
    month: number;
    year: number;
    department_id: number | null;
  } | null>(null);

  const [isCopying, setIsCopying] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    month: number;
    year: number;
    department_id: number | null;
  } | null>(null);

  const [isResettingMonth, setIsResettingMonth] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const departmentOptions = useMemo(
    () => flattenDepartmentTree(departments),
    [departments],
  );

  const isLoadedScopeCurrent =
    loadedScope !== null &&
    loadedScope.month === Number(month) &&
    loadedScope.year === Number(year) &&
    loadedScope.department_id === (departmentId ? Number(departmentId) : null);

  const hasUnsavedChanges = rows.some((row) => {
    if (row.active !== 1) return false;

    const input = row.evaluationValueInput.trim();

    const newValue = input === '' ? null : Number(input);

    return newValue !== row.evaluation_value;
  });

  function changeEvaluationScope(update: () => void): void {
    function applyChange(): void {
      loadGenerationRef.current += 1;
      setRows([]);
      setLoadedScope(null);
      update();
    }

    if (!hasUnsavedChanges) {
      applyChange();
      return;
    }

    // منع ظهور أكثر من رسالة تأكيد
    if (pendingScopeToastRef.current) return;

    pendingScopeToastRef.current = true;

    toast.confirm(
      'فيه تعديلات على التقييمات لسه ما اتحفظتش. هل تريد تجاهلها وتغيير الاختيار؟',
      'تجاهل والمتابعة',
      () => {
        pendingScopeToastRef.current = false;
        applyChange();
      },
      () => {
        pendingScopeToastRef.current = false;
      },
    );
  }

  const orderedEvaluationRows = useMemo(
    () => sortEmployeesByDepartmentTree(rows, departments),
    [rows, departments],
  );

  const evaluationSummary = useMemo(() => {
    const values = rows
      .map((row) => row.evaluationValueInput.trim())
      .filter(Boolean)
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    const total = values.reduce((sum, value) => sum + value, 0);
    const average = values.length > 0 ? total / values.length : 0;
    const missing = rows.filter(
      (row) => !row.evaluationValueInput.trim(),
    ).length;

    return {
      total,
      average,
      entered: values.length,
      missing,
    };
  }, [rows]);

  const visibleEvaluationRows = useMemo(() => {
    const searchText = evaluationSearch.trim().toLowerCase();

    return orderedEvaluationRows.filter((row) => {
      const matchesSearch =
        !searchText ||
        row.employee_name.toLowerCase().includes(searchText) ||
        (row.job_title || '').toLowerCase().includes(searchText) ||
        (row.department_name || '').toLowerCase().includes(searchText);

      const matchesMissing =
        !showMissingOnly ||
        !row.evaluationValueInput.trim() ||
        row.employee_id === activeEvaluationEmployeeId;

      return matchesSearch && matchesMissing;
    });
  }, [
    orderedEvaluationRows,
    evaluationSearch,
    showMissingOnly,
    activeEvaluationEmployeeId,
  ]);

  async function loadRows(): Promise<void> {
    const scope = {
      month: Number(month),
      year: Number(year),
      department_id: departmentId ? Number(departmentId) : null,
    };

    const generation = ++loadGenerationRef.current;

    toast.info('جاري تحميل التقييمات...');

    try {
      setIsLoading(true);

      const evaluationRows = await window.api.evaluations.listEmployees(scope);

      // تجاهل نتيجة طلب قديم لو الاختيار اتغير
      if (generation !== loadGenerationRef.current) return;

      setRows(
        evaluationRows.map((row) => ({
          ...row,
          evaluationValueInput:
            row.evaluation_value === null ? '' : String(row.evaluation_value),
          notesInput: row.evaluation_notes || '',
        })),
      );

      setLoadedScope(scope);

      toast.success('تم تحميل الموظفين');
    } catch (error) {
      if (generation === loadGenerationRef.current) {
        setRows([]);
        setLoadedScope(null);

        const message =
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء تحميل التقييمات';

        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  }
  async function saveEvaluations(): Promise<void> {
    if (!isLoadedScopeCurrent || !loadedScope) {
      toast.warning('حمّل تقييمات الشهر المختار الأول');
      return;
    }
    toast.info('جاري حفظ التقييمات...');

    const editableRows = rows.filter((row) => row.active === 1);

    if (editableRows.length === 0) {
      toast.warning('لا توجد تقييمات نشطة للحفظ');
      return;
    }

    try {
      setIsSaving(true);

      await window.api.evaluations.saveMonth({
        month: loadedScope.month,
        year: loadedScope.year,
        items: editableRows.map((row) => ({
          employee_id: row.employee_id,
          evaluation_value:
            row.evaluationValueInput.trim() === ''
              ? null
              : Number(row.evaluationValueInput),
          notes: '',
        })),
      });

      toast.success('تم حفظ تقييمات الشهر بنجاح');
      await loadRows();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ أثناء حفظ التقييمات';
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  async function copyPreviousMonth(): Promise<void> {
    if (!copyTarget || isCopying || isLoading || isSaving || isResettingMonth) {
      return;
    }

    if (
      !loadedScope ||
      !isLoadedScopeCurrent ||
      hasUnsavedChanges ||
      loadedScope.month !== copyTarget.month ||
      loadedScope.year !== copyTarget.year ||
      loadedScope.department_id !== copyTarget.department_id
    ) {
      setCopyTarget(null);
      toast.warning(
        'بيانات الشهر اتغيرت أو فيه تقييمات غير محفوظة. حمّل الشهر واحفظ التعديلات ثم حاول تاني',
      );
      return;
    }

    const target = copyTarget;

    setCopyTarget(null);
    setIsCopying(true);

    try {
      toast.info('جاري نسخ تقييمات الشهر السابق...');

      const result = await window.api.evaluations.copyPreviousMonth({
        month: target.month,
        year: target.year,
        department_id: target.department_id,
      });

      await loadRows();

      toast.success(`تم نسخ ${result.copied} تقييم من الشهر السابق`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'حدث خطأ أثناء النسخ';

      toast.error(errorMessage);
    } finally {
      setIsCopying(false);
    }
  }

  function requestResetMonth(): void {
    if (hasUnsavedChanges) {
      toast.warning('احفظ التقييمات المعدّلة أولًا قبل التصفير');
      return;
    }

    const selectedMonth = Number(month);
    const selectedYear = Number(year);

    if (
      !Number.isInteger(selectedMonth) ||
      selectedMonth < 1 ||
      selectedMonth > 12 ||
      !Number.isInteger(selectedYear) ||
      selectedYear < 2000 ||
      selectedYear > 2100
    ) {
      toast.error('اختار شهر وسنة صحيحين');
      return;
    }

    const selectedDepartmentId = departmentId ? Number(departmentId) : null;

    if (
      selectedDepartmentId !== null &&
      !departmentOptions.some(
        (department) => department.id === selectedDepartmentId,
      )
    ) {
      toast.error('اختار إدارة صحيحة');
      return;
    }

    setResetTarget({
      month: selectedMonth,
      year: selectedYear,
      department_id: selectedDepartmentId,
    });
  }

  async function confirmResetMonth(): Promise<void> {
    if (!resetTarget || isResettingMonth) return;

    const target = resetTarget;
    setResetTarget(null);

    try {
      setIsResettingMonth(true);

      const result = await window.api.evaluations.resetMonth(target);

      loadGenerationRef.current += 1;
      setRows([]);
      setLoadedScope(null);

      if (result.deleted === 0) {
        toast.info('لا توجد تقييمات محفوظة في هذا الشهر');
        return;
      }

      toast.success(`تم تصفير ${result.deleted} تقييم بنجاح`);
      toast.info(
        'تم حفظ نسخة أمان قبل التصفير. اضغط تحميل الموظفين لتحديث الجدول',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'حدث خطأ أثناء تصفير الشهر';

      toast.error(message);
    } finally {
      setIsResettingMonth(false);
    }
  }

  function updateEvaluationValue(employeeId: number, value: string): void {
    const cleanValue = value.replace(/[^\d.]/g, '');

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.employee_id === employeeId
          ? { ...row, evaluationValueInput: cleanValue }
          : row,
      ),
    );
  }

  useEffect(() => {
    let isMounted = true;

    window.api.departments
      .list({ includeInactive: true })
      .then((departmentRows) => {
        if (isMounted) {
          setDepartments(departmentRows);
        }
      })
      .catch(() => {
        if (isMounted) {
          toast.error('حدث خطأ أثناء تحميل الإدارات');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function requestLoadRows(): void {
    if (hasUnsavedChanges) {
      toast.warning('احفظ التقييمات المعدّلة أولًا قبل إعادة التحميل');
      return;
    }

    void loadRows();
  }

  function requestCopyPreviousMonth(): void {
    if (isCopying || isLoading || isSaving || isResettingMonth) {
      return;
    }

    if (!loadedScope || !isLoadedScopeCurrent) {
      toast.warning('اختار الشهر والإدارة واضغط تحميل الموظفين الأول');
      return;
    }

    if (hasUnsavedChanges) {
      toast.warning('احفظ التقييمات المعدّلة أولًا قبل نسخ الشهر السابق');
      return;
    }

    setCopyTarget({
      month: loadedScope.month,
      year: loadedScope.year,
      department_id: loadedScope.department_id,
    });
  }

  function focusNextEvaluationInput(currentIndex: number): void {
    const nextRow = visibleEvaluationRows
      .slice(currentIndex + 1)
      .find((row) => row.active === 1);

    if (!nextRow) {
      return;
    }

    evaluationInputRefs.current[nextRow.employee_id]?.focus();
    evaluationInputRefs.current[nextRow.employee_id]?.select();
  }

  function handleEvaluationKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    currentIndex: number,
  ): void {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    focusNextEvaluationInput(currentIndex);
  }

  function escapeEvaluationPdfHtml(
    value: string | number | null | undefined,
  ): string {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function buildMonthlyEvaluationsPdfHtml(): string {
    const selectedDepartment = departmentId
      ? departmentOptions.find(
          (department) => department.id === Number(departmentId),
        )
      : null;

    const tableRows = visibleEvaluationRows
      .map(
        (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="text-cell">${escapeEvaluationPdfHtml(row.employee_name)}</td>
          <td class="text-cell">${escapeEvaluationPdfHtml(row.qualification || '-')}</td>
          <td class="text-cell">${escapeEvaluationPdfHtml(row.department_name || '-')}</td>
          <td class="text-cell">${escapeEvaluationPdfHtml(row.job_title || '-')}</td>
          <td>${escapeEvaluationPdfHtml(row.evaluationValueInput)}</td>
          <td class="text-cell">${escapeEvaluationPdfHtml(row.notesInput || '-')}</td>
        </tr>
      `,
      )
      .join('');

    return `
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />

        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            background: white;
            color: #111;
            direction: rtl;
            font-family: Tahoma, Arial, sans-serif;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            border-bottom: 2px solid #111;
            padding-bottom: 8px;
            margin-bottom: 12px;
          }

          h1 {
            margin: 0 0 6px;
            font-size: 20px;
          }

          .subtitle {
            font-size: 11px;
            line-height: 1.8;
          }

          .meta {
            direction: rtl;
            text-align: left;
            font-size: 10px;
            line-height: 1.8;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid #333;
            padding: 6px 4px;
            font-size: 10px;
            line-height: 1.4;
            text-align: center;
            vertical-align: middle;
            overflow-wrap: anywhere;
          }

          th {
            background: #e5e7eb;
            font-weight: 700;
          }

          .text-cell {
            text-align: right;
          }

          .no-data {
            text-align: center;
            padding: 24px;
            font-size: 13px;
          }
        </style>
      </head>

      <body>
        <div class="header">
          <div>
            <h1>قائمة تقييمات الشهر</h1>

            <div class="subtitle">
              الإدارة:
              ${escapeEvaluationPdfHtml(selectedDepartment?.path || 'كل الإدارات')}
              <br />
              عدد الموظفين: ${visibleEvaluationRows.length}
            </div>
          </div>

          <div class="meta">
            الشهر: ${escapeEvaluationPdfHtml(month)}
            <br />
            السنة: ${escapeEvaluationPdfHtml(year)}
            <br />
            تاريخ الطباعة:
            ${escapeEvaluationPdfHtml(new Date().toLocaleDateString('ar-EG'))}
          </div>
        </div>

        <table>
          <colgroup>
            <col style="width: 5%" />
            <col style="width: 18%" />
            <col style="width: 15%" />
            <col style="width: 17%" />
            <col style="width: 15%" />
            <col style="width: 10%" />
            <col style="width: 20%" />
          </colgroup>

          <thead>
            <tr>
              <th>م</th>
              <th>اسم الموظف</th>
              <th>المؤهل</th>
              <th>الإدارة</th>
              <th>الوظيفة</th>
              <th>التقييم</th>
              <th>الملاحظات</th>
            </tr>
          </thead>

          <tbody>
            ${
              tableRows ||
              '<tr><td class="no-data" colspan="7">لا توجد بيانات</td></tr>'
            }
          </tbody>
        </table>
      </body>
    </html>
  `;
  }

  async function exportMonthlyEvaluationsToPdf(): Promise<void> {
    if (!isLoadedScopeCurrent) {
      toast.warning('حمّل تقييمات الشهر المختار قبل التصدير');
      return;
    }

    if (visibleEvaluationRows.length === 0) {
      toast.warning('لا توجد تقييمات ظاهرة لتصديرها');
      return;
    }

    try {
      setIsExportingPdf(true);

      const result = await window.api.reports.savePdf({
        html: buildMonthlyEvaluationsPdfHtml(),
        fileName: `Monthly_Evaluations_${year}_${month}.pdf`,
      });

      if (result.canceled) {
        toast.info('تم إلغاء حفظ PDF');
        return;
      }

      toast.success('تم حفظ قائمة تقييمات الشهر PDF');
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء حفظ قائمة التقييمات';

      toast.error(errorMessage);
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <>
      <section className="card">
        <h2>التقييمات الشهرية</h2>

        <div className="form-grid">
          <label>
            السنة
            <input
              disabled={isSaving || isLoading || isResettingMonth || isCopying}
              value={year}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, '');

                changeEvaluationScope(() => setYear(value));
              }}
            />
          </label>

          <label>
            الشهر
            <select
              disabled={isSaving || isLoading || isResettingMonth || isCopying}
              value={month}
              onChange={(event) => {
                const value = event.target.value;

                changeEvaluationScope(() => setMonth(value));
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map(
                (monthNumber) => (
                  <option key={monthNumber} value={monthNumber}>
                    {monthNumber}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            الإدارة
            <select
              disabled={isSaving || isLoading || isResettingMonth || isCopying}
              value={departmentId}
              onChange={(event) => {
                const value = event.target.value;

                changeEvaluationScope(() => setDepartmentId(value));
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
        </div>

        <div className="actions-row">
          <button
            className="primary-button"
            disabled={isLoading || isSaving || isResettingMonth || isCopying}
            onClick={requestLoadRows}
          >
            {isLoading ? 'جاري التحميل...' : 'تحميل الموظفين'}
          </button>

          <button
            className="secondary-button"
            disabled={isSaving || isLoading || isResettingMonth || isCopying}
            onClick={requestCopyPreviousMonth}
          >
            {isCopying ? 'جاري النسخ...' : 'نسخ من الشهر السابق'}
          </button>

          <button
            className="primary-button"
            disabled={
              isSaving ||
              isLoading ||
              isResettingMonth ||
              isCopying ||
              !isLoadedScopeCurrent ||
              !rows.some((row) => row.active === 1)
            }
            onClick={saveEvaluations}
          >
            {isSaving ? 'جاري الحفظ...' : 'حفظ التقييمات'}
          </button>

          <button
            className="secondary-button"
            disabled={
              isExportingPdf ||
              isCopying ||
              isLoading ||
              isSaving ||
              isResettingMonth ||
              !isLoadedScopeCurrent ||
              visibleEvaluationRows.length === 0
            }
            onClick={exportMonthlyEvaluationsToPdf}
          >
            {isExportingPdf ? 'جاري إنشاء PDF...' : 'قائمة تقييمات الشهر PDF'}
          </button>

          <button
            className="danger-button"
            disabled={isResettingMonth || isSaving || isLoading || isCopying}
            onClick={requestResetMonth}
          >
            {isResettingMonth
              ? 'جاري التصفير...'
              : departmentId
                ? 'تصفير تقييمات الإدارة للشهر'
                : 'تصفير تقييمات الشهر بالكامل'}
          </button>
        </div>
      </section>

      {rows.length > 0 && (
        <section className="card">
          <div className="evaluation-summary-grid">
            <div className="evaluation-summary-card">
              <span>عدد الموظفين</span>
              <strong>{rows.length}</strong>
            </div>

            <div className="evaluation-summary-card success-card">
              <span>تم إدخال تقييم</span>
              <strong>{evaluationSummary.entered}</strong>
            </div>

            <div className="evaluation-summary-card warning-card">
              <span>ناقص تقييم</span>
              <strong>{evaluationSummary.missing}</strong>
            </div>

            <div className="evaluation-summary-card">
              <span>الإجمالي</span>
              <strong>{evaluationSummary.total.toFixed(2)}</strong>
            </div>

            <div className="evaluation-summary-card success-card">
              <span>المتوسط</span>
              <strong>{evaluationSummary.average.toFixed(2)}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="card">
        {rows.length > 0 && (
          <section className="card">
            <div className="form-grid">
              <label>
                بحث داخل الموظفين
                <input
                  value={evaluationSearch}
                  placeholder="اكتب اسم الموظف أو الوظيفة أو الإدارة"
                  onChange={(event) => setEvaluationSearch(event.target.value)}
                />
              </label>

              <label className="checkbox-label inline-checkbox">
                <input
                  type="checkbox"
                  checked={showMissingOnly}
                  onChange={(event) => setShowMissingOnly(event.target.checked)}
                />
                إظهار الناقص تقييمهم فقط
              </label>
            </div>
          </section>
        )}

        <div className="section-header">
          <h2>قائمة تقييمات الشهر</h2>
          <span>
            المعروض: {visibleEvaluationRows.length} / الإجمالي: {rows.length}
          </span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>اسم الموظف</th>
                <th>المؤهل</th>
                <th>الإدارة</th>
                <th>الوظيفة</th>
                <th>التقييم</th>
                <th>ملاحظات</th>
              </tr>
            </thead>

            <tbody>
              {visibleEvaluationRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    {rows.length === 0
                      ? 'اختار الشهر ثم اضغط تحميل الموظفين'
                      : 'لا توجد نتائج مطابقة للبحث'}
                  </td>
                </tr>
              ) : (
                visibleEvaluationRows.map((row, index) => (
                  <tr key={row.employee_id}>
                    <td>{index + 1}</td>
                    <td>
                      {row.employee_name}
                      {row.active !== 1 && (
                        <small
                          style={{
                            display: 'block',
                            color: '#b45309',
                            fontWeight: 700,
                          }}
                        >
                          معطّل - تقييم محفوظ
                        </small>
                      )}
                    </td>
                    <td>{row.qualification || '-'}</td>
                    <td>{row.department_name || '-'}</td>
                    <td>{row.job_title || '-'}</td>
                    <td>
                      <input
                        disabled={row.active !== 1}
                        ref={(element) => {
                          evaluationInputRefs.current[row.employee_id] =
                            element;
                        }}
                        className="table-input"
                        value={row.evaluationValueInput}
                        inputMode="decimal"
                        onFocus={(event) => {
                          setActiveEvaluationEmployeeId(row.employee_id);
                          event.target.select();
                        }}
                        onBlur={() => {
                          setActiveEvaluationEmployeeId(null);
                        }}
                        onKeyDown={(event) =>
                          handleEvaluationKeyDown(event, index)
                        }
                        onChange={(event) =>
                          updateEvaluationValue(
                            row.employee_id,
                            event.target.value,
                          )
                        }
                      />
                    </td>
                    <td>{row.notesInput || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={copyTarget !== null}
        title="تأكيد نسخ تقييمات الشهر السابق"
        message={
          copyTarget
            ? `هل تريد نسخ تقييمات شهر ${
                copyTarget.month === 1 ? 12 : copyTarget.month - 1
              } سنة ${
                copyTarget.month === 1 ? copyTarget.year - 1 : copyTarget.year
              } إلى شهر ${copyTarget.month} سنة ${copyTarget.year}، ${
                copyTarget.department_id === null
                  ? 'لجميع الإدارات'
                  : `لإدارة "${
                      departmentOptions.find(
                        (department) =>
                          department.id === copyTarget.department_id,
                      )?.name || 'المحددة'
                    }"`
              }؟ التقييمات الموجودة لن يتم استبدالها.`
            : ''
        }
        confirmText="تأكيد النسخ"
        cancelText="إلغاء"
        onConfirm={() => {
          void copyPreviousMonth();
        }}
        onCancel={() => setCopyTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        title="تأكيد تصفير التقييمات"
        message={
          resetTarget
            ? `تحذير: سيتم حذف التقييمات المحفوظة لشهر ${resetTarget.month} سنة ${resetTarget.year} ${
                resetTarget.department_id === null
                  ? 'من جميع الإدارات'
                  : `من إدارة "${
                      departmentOptions.find(
                        (d) => d.id === resetTarget.department_id,
                      )?.name || 'المختارة'
                    }" وجميع الإدارات التابعة لها`
              }، بما فيها تقييمات الموظفين المعطّلين. سيتم إنشاء نسخة أمان أولًا. هل أنت متأكد؟`
            : ''
        }
        confirmText="نعم، تصفير التقييمات"
        cancelText="إلغاء"
        danger
        onConfirm={() => {
          void confirmResetMonth();
        }}
        onCancel={() => setResetTarget(null)}
      />
    </>
  );
}
