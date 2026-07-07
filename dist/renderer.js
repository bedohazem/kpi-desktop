"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api = window.api;
let departments = [];
let currentEvaluationRows = [];
const months = [
    { id: 1, name: "يناير" },
    { id: 2, name: "فبراير" },
    { id: 3, name: "مارس" },
    { id: 4, name: "أبريل" },
    { id: 5, name: "مايو" },
    { id: 6, name: "يونيو" },
    { id: 7, name: "يوليو" },
    { id: 8, name: "أغسطس" },
    { id: 9, name: "سبتمبر" },
    { id: 10, name: "أكتوبر" },
    { id: 11, name: "نوفمبر" },
    { id: 12, name: "ديسمبر" }
];
document.addEventListener("DOMContentLoaded", async () => {
    setupTabs();
    fillYears();
    fillMonths();
    await loadDepartments();
    await loadEmployees();
});
function setupTabs() {
    document.querySelectorAll(".tab").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
            document.querySelectorAll("section").forEach((s) => s.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab)?.classList.add("active");
        });
    });
}
function fillYears() {
    const year = new Date().getFullYear();
    const years = [year - 2, year - 1, year, year + 1];
    ["evalYear", "reportYear"].forEach((id) => {
        const select = document.getElementById(id);
        select.innerHTML = "";
        for (const y of years) {
            const opt = document.createElement("option");
            opt.value = String(y);
            opt.textContent = String(y);
            if (y === year)
                opt.selected = true;
            select.appendChild(opt);
        }
    });
}
function fillMonths() {
    ["evalMonth", "reportFromMonth", "reportToMonth"].forEach((id) => {
        const select = document.getElementById(id);
        select.innerHTML = "";
        for (const m of months) {
            const opt = document.createElement("option");
            opt.value = String(m.id);
            opt.textContent = m.name;
            select.appendChild(opt);
        }
    });
}
/* =====================
   الإدارات
===================== */
async function loadDepartments() {
    departments = await api.departments.list();
    const tbody = document.getElementById("departmentsTable");
    tbody.innerHTML = "";
    for (const dep of departments) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${dep.name || ""}</td>
      <td>${dep.parent_name || "-"}</td>
      <td>${dep.notes || ""}</td>
      <td>${dep.active ? "نشطة" : "غير نشطة"}</td>
    `;
        tbody.appendChild(tr);
    }
    fillDepartmentSelects();
}
function fillDepartmentSelects() {
    const ids = [
        "depParent",
        "empDepartment",
        "empFilterDepartment",
        "evalDepartment",
        "reportDepartment"
    ];
    for (const id of ids) {
        const select = document.getElementById(id);
        if (!select)
            continue;
        select.innerHTML = "";
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = id === "depParent" ? "بدون إدارة رئيسية" : "كل الإدارات";
        select.appendChild(empty);
        for (const dep of departments) {
            const opt = document.createElement("option");
            opt.value = String(dep.id);
            opt.textContent = dep.name;
            select.appendChild(opt);
        }
    }
}
async function saveDepartment() {
    const name = document.getElementById("depName").value.trim();
    const parent_id = Number(document.getElementById("depParent").value || 0);
    const notes = document.getElementById("depNotes").value.trim();
    if (!name) {
        alert("اكتب اسم الإدارة");
        return;
    }
    await api.departments.create({
        name,
        parent_id,
        notes,
        active: true
    });
    document.getElementById("depName").value = "";
    document.getElementById("depNotes").value = "";
    await loadDepartments();
}
/* =====================
   الموظفين
===================== */
async function loadEmployees() {
    const search = document.getElementById("empSearch")?.value || "";
    const department_id = Number(document.getElementById("empFilterDepartment")?.value || 0);
    const employees = await api.employees.list({
        search,
        department_id
    });
    const tbody = document.getElementById("employeesTable");
    tbody.innerHTML = "";
    for (const emp of employees) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${emp.employee_number || ""}</td>
      <td>${emp.name || ""}</td>
      <td>${emp.national_id || ""}</td>
      <td>${emp.qualification || ""}</td>
      <td>${emp.job_title || ""}</td>
      <td>${emp.department_name || ""}</td>
    `;
        tbody.appendChild(tr);
    }
}
async function saveEmployee() {
    const employee_number = document.getElementById("empNumber").value.trim();
    const name = document.getElementById("empName").value.trim();
    const national_id = document.getElementById("empNationalId").value.trim();
    const qualification = document.getElementById("empQualification").value.trim();
    const job_title = document.getElementById("empJobTitle").value.trim();
    const department_id = Number(document.getElementById("empDepartment").value || 0);
    const notes = document.getElementById("empNotes").value.trim();
    if (!name) {
        alert("اكتب اسم الموظف");
        return;
    }
    await api.employees.create({
        employee_number,
        name,
        national_id,
        qualification,
        job_title,
        department_id,
        notes,
        active: true
    });
    ["empNumber", "empName", "empNationalId", "empQualification", "empJobTitle", "empNotes"].forEach((id) => {
        document.getElementById(id).value = "";
    });
    await loadEmployees();
}
/* =====================
   التقييمات
===================== */
async function loadEvaluationMonth() {
    const year = Number(document.getElementById("evalYear").value);
    const month = Number(document.getElementById("evalMonth").value);
    const department_id = Number(document.getElementById("evalDepartment").value || 0);
    currentEvaluationRows = await api.evaluations.loadMonth({
        year,
        month,
        department_id
    });
    const tbody = document.getElementById("evaluationsTable");
    tbody.innerHTML = "";
    for (const row of currentEvaluationRows) {
        const tr = document.createElement("tr");
        tr.dataset.employeeId = String(row.employee_id);
        tr.innerHTML = `
      <td>${row.employee_number || ""}</td>
      <td>${row.name || ""}</td>
      <td>${row.job_title || ""}</td>
      <td>${row.department_name || ""}</td>
      <td>
        <input 
          type="number" 
          class="eval-value" 
          value="${row.evaluation_value ?? ""}" 
          style="width:120px"
        />
      </td>
      <td>
        <input 
          class="eval-notes" 
          value="${row.evaluation_notes || ""}" 
          style="width:250px"
        />
      </td>
    `;
        tbody.appendChild(tr);
    }
}
async function saveEvaluations() {
    const year = Number(document.getElementById("evalYear").value);
    const month = Number(document.getElementById("evalMonth").value);
    const rows = [];
    document.querySelectorAll("#evaluationsTable tr").forEach((tr) => {
        const employee_id = Number(tr.dataset.employeeId);
        const evaluation_value = tr.querySelector(".eval-value").value;
        const notes = tr.querySelector(".eval-notes").value;
        rows.push({
            employee_id,
            evaluation_value,
            notes
        });
    });
    await api.evaluations.saveBulk({
        year,
        month,
        rows
    });
    alert("تم حفظ التقييمات");
}
/* =====================
   التقارير
===================== */
async function loadReport() {
    const year = Number(document.getElementById("reportYear").value);
    const from_month = Number(document.getElementById("reportFromMonth").value);
    const to_month = Number(document.getElementById("reportToMonth").value);
    const department_id = Number(document.getElementById("reportDepartment").value || 0);
    const rows = await api.reports.employeePeriod({
        year,
        from_month,
        to_month,
        department_id
    });
    const monthList = months.filter((m) => m.id >= from_month && m.id <= to_month);
    const grouped = {};
    for (const row of rows) {
        if (!grouped[row.employee_id]) {
            grouped[row.employee_id] = {
                employee_number: row.employee_number,
                name: row.name,
                job_title: row.job_title,
                department_name: row.department_name,
                months: {},
                total: 0,
                count: 0
            };
        }
        if (row.month) {
            grouped[row.employee_id].months[row.month] = row.evaluation_value || 0;
            grouped[row.employee_id].total += row.evaluation_value || 0;
            grouped[row.employee_id].count += 1;
        }
    }
    const head = document.getElementById("reportHead");
    const body = document.getElementById("reportBody");
    head.innerHTML = `
    <tr>
      <th>رقم الموظف</th>
      <th>الاسم</th>
      <th>الوظيفة</th>
      <th>الإدارة</th>
      ${monthList.map((m) => `<th>${m.name}</th>`).join("")}
      <th>الإجمالي</th>
      <th>المتوسط</th>
    </tr>
  `;
    body.innerHTML = "";
    Object.values(grouped).forEach((emp) => {
        const avg = emp.count ? emp.total / emp.count : 0;
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${emp.employee_number || ""}</td>
      <td>${emp.name || ""}</td>
      <td>${emp.job_title || ""}</td>
      <td>${emp.department_name || ""}</td>
      ${monthList.map((m) => `<td>${emp.months[m.id] ?? ""}</td>`).join("")}
      <td>${emp.total}</td>
      <td>${avg.toFixed(2)}</td>
    `;
        body.appendChild(tr);
    });
}
window.saveDepartment = saveDepartment;
window.saveEmployee = saveEmployee;
window.loadEmployees = loadEmployees;
window.loadEvaluationMonth = loadEvaluationMonth;
window.saveEvaluations = saveEvaluations;
window.loadReport = loadReport;
