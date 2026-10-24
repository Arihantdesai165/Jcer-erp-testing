# JCER ERP — Production API Endpoints Contract & Reference

This document serves as the authoritative production contract for the JCER ERP API layer, documenting route paths, methods, role requirements, department scoping rules, request parameters/payloads, responses, and error conditions.

---

## Architecture Principles

1. **Authentication & Identity**: All protected endpoints require a valid Bearer JWT in the `Authorization: Bearer <token>` header.
2. **Department Isolation**: Endpoints in the `/api/hod/*` namespace strictly derive the active department from the authenticated HOD's database record. Frontend-supplied `departmentId` queries are rejected or strictly enforced against the authenticated user's department to prevent cross-department privilege escalation.
3. **Canonical Route Namespaces**:
   - `/api/auth/*` — User authentication, password reset, profile
   - `/api/hod/*` — Department HOD operations (students, sections, subjects, faculty, attendance, reports)
   - `/api/admin/*` — College administration, admissions, onboarding, user provisioning
   - `/api/faculty/*` — Faculty portal, assignments, student attendance/marks entry
   - `/api/students/*` — Student directory and academic profile
   - `/api/health` — System status and database connectivity

---

## 1. System Health Diagnostic

### `GET /api/health`
- **Role**: Public
- **Description**: Verifies API gateway and database connection status.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "jcer-erp-api",
    "database": "connected"
  }
  ```

---

## 2. HOD Module Endpoints (`/api/hod/*`)

All HOD endpoints enforce `authenticateToken` + `authorize('HOD')` + automatic department scoping.

### 2.1 Dashboard & Metrics
#### `GET /api/hod/dashboard`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "department": { "id": "uuid", "name": "Electronics & Communication Engineering", "code": "ECE" },
      "stats": {
        "totalStudents": 142,
        "totalFaculty": 18,
        "totalSubjects": 32,
        "totalSections": 6
      }
    }
  }
  ```

---

### 2.2 Students Management
#### `GET /api/hod/students`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Query Parameters**:
  - `academicYear` (optional string, e.g., `'2026-27'`)
  - `semester` (optional integer, e.g., `3`)
  - `section` (optional string, e.g., `'A'`)
  - `search` (optional string USN/name)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "usn": "2JR25EC064",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@jcer.ac.in",
        "phone": "9876543210",
        "admissionQuota": "CET",
        "academicEnrollment": {
          "semester": 3,
          "academicYear": "2026-27",
          "section": "A",
          "status": "ACTIVE"
        }
      }
    ]
  }
  ```

---

### 2.3 Section Management
#### `GET /api/hod/sections`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Query Parameters**:
  - `semester` (optional integer)
  - `academicYear` (optional string)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "name": "Section A",
        "semester": 3,
        "academicYear": "2026-27",
        "capacity": 60,
        "classroom": "301",
        "description": "ECE Div A",
        "allocatedCount": 54
      }
    ]
  }
  ```

#### `POST /api/hod/sections`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Request Body**:
  ```json
  {
    "name": "Section A",
    "semester": 3,
    "academicYear": "2026-27",
    "capacity": 60,
    "classroom": "301",
    "description": "Optional notes"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "message": "Section created successfully",
    "data": { "id": "uuid", "name": "Section A", "semester": 3, "academicYear": "2026-27" }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (name/semester/academicYear missing).
  - `409 Conflict`: A section with this name already exists in the department for the specified academic year and semester.

#### `PUT /api/hod/sections/:id` or `PATCH /api/hod/sections/:id`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department (validates ownership of section)
- **Request Body**:
  ```json
  {
    "name": "Section A1",
    "capacity": 65,
    "classroom": "302"
  }
  ```
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Section updated successfully", "data": { ... } }
  ```

#### `DELETE /api/hod/sections/:id`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Response `200 OK`**:
  ```json
  { "success": true, "message": "Section deleted successfully" }
  ```
- **Error Responses**:
  - `409 Conflict`: Cannot delete section when students are currently assigned to it.

---

### 2.4 Subject Management
#### `GET /api/hod/subjects`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Query Parameters**:
  - `semester` (optional integer)
  - `type` (optional `'IPCC' | 'CC'`)
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "code": "22EC31",
        "name": "Electronic Principles & Circuits",
        "semester": 3,
        "credits": 4,
        "type": "IPCC",
        "status": "ACTIVE"
      }
    ]
  }
  ```

#### `POST /api/hod/subjects`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Request Body**:
  ```json
  {
    "code": "22EC31",
    "name": "Electronic Principles & Circuits",
    "semester": 3,
    "credits": 4,
    "type": "IPCC"
  }
  ```
- **Response `201 Created`**:
  ```json
  { "success": true, "message": "Subject created successfully", "data": { "id": "uuid", ... } }
  ```
- **Error Responses**:
  - `400 Bad Request`: Course type must be IPCC or CC.
  - `409 Conflict`: Subject code already exists in department.

#### `DELETE /api/hod/subjects/:id`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Academic Protection Rule**:
  - Checks if the subject is linked to `faculty_assignments`, `attendance_records`, or `assessments`.
  - If records exist: Hard delete is blocked. The backend transitions the subject to `INACTIVE` status (or returns `409 Conflict` with code `SUBJECT_HAS_ACADEMIC_DATA` when hard delete is requested).
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "message": "Subject deleted or deactivated successfully",
    "deactivated": false
  }
  ```
- **Response `409 Conflict` (when blocked from hard delete)**:
  ```json
  {
    "success": false,
    "code": "SUBJECT_HAS_ACADEMIC_DATA",
    "message": "Cannot hard delete subject with existing faculty assignments, attendance, or assessment records. Marked as INACTIVE."
  }
  ```

---

### 2.5 Faculty & Assignments Management
#### `GET /api/hod/faculty`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Response `200 OK`**: Returns list of faculty members in the department.

#### `POST /api/hod/faculty/assign`
- **Role**: `HOD`
- **Scope**: Authenticated HOD department
- **Request Body**:
  ```json
  {
    "teacherId": "uuid",
    "subjectId": "uuid",
    "semester": 3,
    "section": "A",
    "academicYear": "2026-27"
  }
  ```
- **Response `201 Created`**: Returns created assignment and links to faculty access.

---

## 3. Centralized API Error Codes

| HTTP Status | Error Code | Meaning | User Message |
|:---|:---|:---|:---|
| 400 | `VALIDATION_ERROR` | Malformed body or missing required field | Please check the entered details and try again. |
| 401 | `UNAUTHORIZED` | Expired or missing Bearer token | Your session has expired. Please log in again. |
| 403 | `FORBIDDEN` | Role mismatch or cross-department access attempt | You do not have permission for this department resource. |
| 404 | `ENDPOINT_NOT_FOUND` | Path or method not registered | Requested API operation is unavailable. |
| 409 | `RESOURCE_CONFLICT` / `SUBJECT_HAS_ACADEMIC_DATA` | Duplicate entry or constraint violation | Resource conflict or academic history prevents hard delete. |
| 422 | `UNPROCESSABLE_ENTITY` | Semantic business rule violation | The requested action violates academic rules. |
| 500 | `INTERNAL_SERVER_ERROR` | Unhandled backend exception | Something went wrong on the server. Request logged with ID. |
