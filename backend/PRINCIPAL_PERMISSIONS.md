# Principal Role - Permission Mapping

## Endpoints Principal CAN Access (Change to IsPrincipalOrAdmin)

### Fee Management
- ✓ update_student_fee_record (PATCH) - Manage fees
- ✓ record_fee_payment (POST) - Record payments
- ✓ get_fee_receipt (GET) - View receipts
- ✓ download_fee_receipt (GET) - Download receipts
- ✓ get_all_fee_receipts (GET) - View all receipts

### Attendance
- ✓ mark_attendance (POST) - Mark attendance
- ✓ All attendance viewing endpoints

### Report Sheets
- ✓ get_students_for_report (GET) - View students
- ✓ get_report_sheet (GET) - View report sheets
- ✓ download_report_sheet (GET) - Download reports
- ✓ send_report_sheets (POST) - Send reports to parents
- ✓ send_individual_report (POST) - Send individual reports

### Analytics & Viewing
- ✓ get_exam_completion_stats (GET) - View exam stats
- ✓ get_report_access_stats (GET) - View report analytics
- ✓ View student profiles (read-only)
- ✓ View teacher profiles (read-only)
- ✓ View class performance
- ✓ get_subject_grades (GET) - View grades (read-only)

### Special Actions
- ✓ unlock_grade_component (POST) - Unlock grades for editing

## Endpoints Principal CANNOT Access (Keep as IsAdminRole)

### System Management
- ✗ move_to_next_term (POST) - Admin only
- ✗ move_to_next_session (POST) - Admin only
- ✗ send_announcement (POST) - Admin only

### Grade Editing
- ✗ update_grade_component (PATCH) - Cannot edit grades directly
- ✗ save_all_grades (POST) - Cannot save grades
- ✗ Any grade modification endpoints

### User Management
- ✗ Create/edit/delete teachers
- ✗ Create/edit/delete students
- ✗ Create/edit/delete parents
- ✗ Assign teachers to subjects
- ✗ Assign students to classes

### Grading Configuration
- ✗ create_grading_configuration (POST)
- ✗ update_grading_configuration (PATCH)
- ✗ Any configuration modification

### Academic Structure
- ✗ Create/edit/delete classes
- ✗ Create/edit/delete subjects
- ✗ Create/edit/delete class sessions
