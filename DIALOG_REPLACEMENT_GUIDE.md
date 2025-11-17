# Dialog Replacement Guide

This document tracks the replacement of all native browser dialogs (window.confirm and alert) with custom-designed dialogs.

## ✅ Completed Components

### 1. ViewSubjects.jsx
- **Status**: ✅ Complete
- **Changes**:
  - Added `import { useDialog } from '../contexts/DialogContext'`
  - Added `const { showConfirm, showAlert } = useDialog()`
  - Replaced `window.confirm` for delete subject confirmation
  - Replaced `alert` for error message

---

## 📋 Pending Components

### Pattern to Follow for Each Component:

1. **Add import**: `import { useDialog } from '../contexts/DialogContext'`
2. **Add hook**: `const { showConfirm, showAlert } = useDialog()`
3. **Replace window.confirm**:
   ```javascript
   // OLD:
   if (!window.confirm('Delete this?')) return;

   // NEW:
   const confirmed = await showConfirm({
     title: 'Confirm Delete',
     message: 'Are you sure you want to delete this? This action cannot be undone.',
     confirmText: 'Delete',
     cancelText: 'Cancel',
     confirmButtonClass: 'confirm-btn-danger'
   });
   if (!confirmed) return;
   ```

4. **Replace alert**:
   ```javascript
   // OLD:
   alert('Success!');

   // NEW:
   showAlert({
     type: 'success', // or 'error', 'warning', 'info'
     message: 'Operation completed successfully!'
   });
   ```

---

## Components Requiring Updates

### 2. CreateFeeStructure.jsx
**Line 146**: Delete fee structure
```javascript
// Replace:
if (!window.confirm('Delete this fee?')) return;

// With:
const confirmed = await showConfirm({
  title: 'Delete Fee Structure',
  message: 'Are you sure you want to delete this fee structure?',
  confirmText: 'Delete',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;
```

### 3. ViewUsers.jsx
**Line 51, 143**: Error alerts
**Line 153**: Delete user confirmation
**Line 160**: Success alert
**Line 163**: Error alert

Updates needed:
```javascript
// Line 153 - Delete confirmation
const confirmed = await showConfirm({
  title: 'Delete User',
  message: 'Are you sure you want to delete this user? This action cannot be undone.',
  confirmText: 'Delete',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;

// Line 51, 143 - Error alerts
showAlert({
  type: 'error',
  message: 'Failed to load student history.'
});

// Line 160 - Success alert
showAlert({
  type: 'success',
  message: 'User deleted successfully.'
});

// Line 163 - Error alert
showAlert({
  type: 'error',
  message: 'Failed to delete user.'
});
```

### 4. ViewClasses.jsx
**Line 142, 152, 183**: Delete confirmations

Updates needed:
```javascript
// Line 142 - Bulk delete
const confirmed = await showConfirm({
  title: 'Delete Class Sessions',
  message: confirmMessage,
  confirmText: 'Delete All',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;

// Line 152 - Single delete
const confirmed = await showConfirm({
  title: 'Delete Class Session',
  message: `Delete ${match.classroom.name} (${match.term}, ${match.academic_year})?`,
  confirmText: 'Delete',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;

// Line 183 - Permanent class delete
const confirmed = await showConfirm({
  title: 'Delete Permanent Class',
  message: `Delete ${match.name}? All sessions will be removed.`,
  confirmText: 'Delete',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;
```

### 5. ClassList.jsx
**Line 44**: Delete class confirmation

```javascript
const confirmed = await showConfirm({
  title: 'Delete Class',
  message: 'Are you sure you want to delete this class?',
  confirmText: 'Delete',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;
```

### 6. ReviewQuestions.jsx
**Line 197**: Delete assessment confirmation
**Line 217**: Success alert
**Line 242**: Unlock all confirmation

```javascript
// Line 197
const confirmed = await showConfirm({
  title: 'Delete Assessment',
  message: confirmMessage,
  confirmText: 'Delete',
  confirmButtonClass: 'confirm-btn-danger'
});
if (!confirmed) return;

// Line 217
showAlert({
  type: 'success',
  message: data.message
});

// Line 242
const confirmed = await showConfirm({
  title: 'Unlock Assessments',
  message: `Are you sure you want to unlock all ${typeLabel} ${filterSummary}?`,
  confirmText: 'Unlock',
  confirmButtonClass: 'confirm-btn-warning'
});
if (!confirmed) return;
```

### 7. TestStudentScoresModal.jsx
**Line 99, 104**: Validation alerts
**Line 128, 157**: Error alerts
**Line 138**: Unlock confirmation
**Line 153**: Success alert

```javascript
// Line 99, 104 - Validation
showAlert({
  type: 'error',
  message: 'Please enter a valid score'
});

showAlert({
  type: 'error',
  message: `Score cannot exceed ${totalMarks}`
});

// Line 128, 157 - Errors
showAlert({
  type: 'error',
  message: 'Failed to update score. Please try again.'
});

// Line 138 - Unlock confirmation
const confirmed = await showConfirm({
  title: 'Unlock Test Scores',
  message: 'Are you sure you want to unlock test scores for this subject? Students will be able to see their results.',
  confirmText: 'Unlock',
  confirmButtonClass: 'confirm-btn-warning'
});
if (!confirmed) return;

// Line 153 - Success
showAlert({
  type: 'success',
  message: 'Test scores unlocked successfully!'
});
```

### 8. DashboardTestsCard.jsx
**Line 147, 170**: Validation and error alerts
**Line 151**: Unlock all confirmation
**Line 167**: Success alert

```javascript
// Line 147
showAlert({
  type: 'warning',
  message: 'Please select academic year and term first'
});

// Line 151
const confirmed = await showConfirm({
  title: 'Unlock All Test Scores',
  message: `Are you sure you want to unlock ALL test scores for ${selectedYear.label} - ${selectedTerm.label}? Students will be able to see their results.`,
  confirmText: 'Unlock All',
  confirmButtonClass: 'confirm-btn-warning'
});
if (!confirmed) return;

// Line 167
showAlert({
  type: 'success',
  message: 'All test scores unlocked successfully!'
});

// Line 170
showAlert({
  type: 'error',
  message: 'Failed to unlock test scores. Please try again.'
});
```

### 9. TakeAssessment.jsx
**Line 91**: Submit assessment confirmation

```javascript
const confirmed = await showConfirm({
  title: `Submit ${assessment.assessment_type === 'final_exam' ? 'Exam' : 'Test'}`,
  message: confirmMessage,
  confirmText: 'Submit',
  confirmButtonClass: 'confirm-btn-primary'
});
if (!confirmed) return;
```

### 10. ViewResults.jsx
**Line 156**: Sync attendance confirmation

```javascript
const confirmed = await showConfirm({
  title: 'Sync Attendance Grades',
  message: `Sync attendance grades for ${selectedYear} - ${selectedTerm}?\n\nThis will calculate attendance scores from your marked attendance records and update the grading system.`,
  confirmText: 'Sync',
  confirmButtonClass: 'confirm-btn-primary'
});
if (!confirmed) return;
```

### 11. EditTeacherModal.jsx
**Line 50**: Success alert

```javascript
showAlert({
  type: 'success',
  message: 'Teacher updated successfully!'
});
```

### 12. FeeStudentModal.jsx
**Line 113, 116**: Success and error alerts

```javascript
// Line 113
showAlert({
  type: 'success',
  message: 'Payment records updated successfully.'
});

// Line 116
showAlert({
  type: 'error',
  message: 'Failed to update one or more records.'
});
```

### 13. EditParentModal.jsx
**Line 80, 85**: Success and error alerts

```javascript
// Line 80
showAlert({
  type: 'success',
  message: 'Parent updated successfully.'
});

// Line 85
showAlert({
  type: 'error',
  message: 'Failed to update parent.'
});
```

### 14. AttendanceStudentTable.jsx
**Line 65**: Missed days info alert

```javascript
showAlert({
  type: 'info',
  title: 'Missed Days',
  message: `${missedDays.length} missed:\n${missedDays.join('\n')}`,
  autoClose: false
});
```

---

## Summary Statistics

- **Total Components**: 14
- **Completed**: 1 (ViewSubjects.jsx)
- **Pending**: 13
- **Total window.confirm**: 13 instances
- **Total alert**: 18 instances
- **Total Replacements**: 31 instances

---

## Button Class Options

Use these for `confirmButtonClass`:
- `confirm-btn-primary` - Blue (default actions)
- `confirm-btn-danger` - Red (delete/destructive actions)
- `confirm-btn-warning` - Orange (unlock/release actions)
- `confirm-btn-success` - Green (approve/confirm actions)

## Alert Type Options

Use these for alert `type`:
- `success` - Green (successful operations)
- `error` - Red (errors and failures)
- `warning` - Orange (warnings and cautions)
- `info` - Blue (informational messages)
