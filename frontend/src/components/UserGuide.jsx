import React, { useState, useMemo } from 'react';
import {
  Search, X, ChevronDown, BookOpen, Lightbulb, Info,
  Rocket, Layers, BookOpenCheck, Settings, Calendar,
  DollarSign, Users, FileText, Megaphone, ArrowRightLeft,
  LayoutDashboard, ClipboardList, CheckSquare, PenTool,
  FileEdit, GraduationCap, Receipt, Download, Eye,
  BarChart3, TrendingUp, Building2, UserCheck, Clock,
  HelpCircle, Shield, Bell, Upload, Palette
} from 'lucide-react';
import './UserGuide.css';

// ─── Content definitions per role ────────────────────────────────────

const adminContent = [
  {
    id: 'getting-started',
    icon: <Rocket />,
    color: 'indigo',
    title: 'Getting Started',
    desc: 'First-time setup checklist to get your school running',
    body: (
      <>
        <h3>Initial Setup Checklist</h3>
        <p>Follow these steps in order to set up your school for the first time. Each step builds on the previous one.</p>
        <div className="kb-steps">
          <div className="kb-step">
            <span className="kb-step-num">1</span>
            <span className="kb-step-text"><strong>Create an Academic Session</strong> — Go to <strong>Session Management</strong> and create your academic year (e.g., "2024/2025"). Then add terms within that session (First Term, Second Term, Third Term).</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">2</span>
            <span className="kb-step-text"><strong>Create Classes</strong> — Go to <strong>Classes</strong> and create your school's classes (e.g., JSS1, SS1). Add arms/sections if needed (e.g., JSS1A, JSS1B).</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">3</span>
            <span className="kb-step-text"><strong>Add Subjects</strong> — Go to <strong>Subjects</strong> and create subjects for each class session. Assign teachers to subjects once teacher accounts are created.</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">4</span>
            <span className="kb-step-text"><strong>Set Up Grading Configuration</strong> — Go to <strong>Settings → Grading</strong> and configure the mark allocation for tests, exams, and attendance for the current term.</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">5</span>
            <span className="kb-step-text"><strong>Create Attendance Calendar</strong> — Go to <strong>Attendance Calendar</strong> and set up school days for the term. This defines which days count toward attendance scoring.</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">6</span>
            <span className="kb-step-text"><strong>Create Fee Structures</strong> — Go to <strong>Fees</strong> and create fee types, then assign them to classes with amounts.</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">7</span>
            <span className="kb-step-text"><strong>Create User Accounts</strong> — Go to <strong>Users</strong> and create accounts for teachers, students, parents, and principals. You can also bulk-import students via CSV.</span>
          </div>
        </div>
        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>You must create the session and classes before adding subjects, since subjects are linked to specific class sessions (a class within a particular academic term).</p>
        </div>
      </>
    ),
  },
  {
    id: 'class-session',
    icon: <Layers />,
    color: 'blue',
    title: 'Class & Session Management',
    desc: 'Academic years, terms, classes, and how they connect',
    body: (
      <>
        <h3>Understanding Sessions</h3>
        <p>A <strong>Session</strong> represents an academic year (e.g., "2024/2025"). Each session contains <strong>Terms</strong> — typically First, Second, and Third Term. Only one term can be active at a time.</p>

        <h3>Creating Classes</h3>
        <p>Classes represent grade levels in your school (e.g., JSS1, SS2). Each class can have multiple <strong>arms</strong> (sections) like A, B, C.</p>
        <ul>
          <li>Navigate to <strong>Classes</strong> in the sidebar</li>
          <li>Click <strong>Create Class</strong>, enter the class name</li>
          <li>Add arms/sections as needed</li>
        </ul>

        <h3>Class Sessions</h3>
        <p>A <strong>Class Session</strong> is automatically created when a class exists in an active term. It links a class to a specific academic year and term. Subjects, students, and grades are all tied to class sessions.</p>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>When you move to a new term, new class sessions are created automatically for the new term. Students are enrolled in the new term's class sessions.</p>
        </div>
      </>
    ),
  },
  {
    id: 'subjects',
    icon: <BookOpenCheck />,
    color: 'green',
    title: 'Subject Management',
    desc: 'Adding subjects, assigning teachers, departments',
    body: (
      <>
        <h3>Adding Subjects</h3>
        <p>Subjects are added per class session. This means each class in each term has its own set of subjects.</p>
        <ul>
          <li>Go to <strong>Subjects</strong> in the sidebar</li>
          <li>Select the class session you want to add subjects to</li>
          <li>Click <strong>Add Subject</strong>, enter the name, and optionally select a department</li>
        </ul>

        <h3>Assigning Teachers</h3>
        <p>Each subject must have a teacher assigned to it. The assigned teacher can then:</p>
        <ul>
          <li>Enter test and exam scores for students in that subject</li>
          <li>Create online assessments (tests and exams)</li>
          <li>Manage subject content and materials</li>
        </ul>

        <h3>Departments</h3>
        <p>You can organize subjects into departments (e.g., Sciences, Arts, Languages). Departments help with filtering and organization but are optional.</p>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>When you move to the next term, subjects from the previous term can be carried over automatically. You'll still need to verify teacher assignments.</p>
        </div>
      </>
    ),
  },
  {
    id: 'grading',
    icon: <Settings />,
    color: 'purple',
    title: 'Grading Configuration',
    desc: 'Test, exam, and attendance mark allocations',
    body: (
      <>
        <h3>How Grading Works</h3>
        <p>Each student's total score per subject is calculated as:</p>
        <p><strong>Total = Test Score + Exam Score + Attendance Score</strong></p>
        <p>You configure how many marks each component is worth in the Grading Configuration.</p>

        <h3>Setting Up Grading</h3>
        <ul>
          <li>Go to <strong>Settings</strong> in the sidebar</li>
          <li>Set the <strong>Test mark allocation</strong> (e.g., 30 marks)</li>
          <li>Set the <strong>Exam mark allocation</strong> (e.g., 60 marks)</li>
          <li>Set the <strong>Attendance mark allocation</strong> (e.g., 10 marks)</li>
          <li>The total should typically add up to 100</li>
        </ul>

        <h3>Grade Boundaries</h3>
        <p>Configure letter grades and their ranges (e.g., A = 70-100, B = 60-69, etc.). These are used on report cards.</p>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Grading configuration is per term. When you move to a new term, a new grading configuration is created. The previous term's configuration is preserved for historical report generation.</p>
        </div>
      </>
    ),
  },
  {
    id: 'attendance-calendar',
    icon: <Calendar />,
    color: 'orange',
    title: 'Attendance Calendar',
    desc: 'School days, holidays, and attendance scoring',
    body: (
      <>
        <h3>What Is the Attendance Calendar?</h3>
        <p>The Attendance Calendar defines which days are school days for the current term. Teachers mark attendance on these days, and the system calculates each student's attendance percentage.</p>

        <h3>Setting Up the Calendar</h3>
        <ul>
          <li>Go to <strong>Attendance Calendar</strong> in the sidebar</li>
          <li>Select the date range for your term</li>
          <li>Mark school days and holidays</li>
          <li>The calendar automatically excludes weekends</li>
        </ul>

        <h3>How Attendance Feeds Into Grades</h3>
        <p>If you set an attendance mark allocation (e.g., 10 marks) in the Grading Configuration, the system automatically calculates each student's attendance score:</p>
        <p><strong>Attendance Score = (Days Present / Total School Days) × Attendance Mark Allocation</strong></p>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>If you don't want attendance to affect grades, set the attendance mark allocation to 0 in Grading Configuration.</p>
        </div>
      </>
    ),
  },
  {
    id: 'fees',
    icon: <DollarSign />,
    color: 'green',
    title: 'Fee Management',
    desc: 'Fee structures, payments, tracking, and receipts',
    body: (
      <>
        <h3>Creating Fee Structures</h3>
        <ul>
          <li>Go to <strong>Fees</strong> in the sidebar</li>
          <li>Click <strong>Create Fee Structure</strong></li>
          <li>Enter the fee name (e.g., "Tuition Fee", "Lab Fee")</li>
          <li>Set the amount and assign it to specific classes</li>
          <li>Fees are tied to the current term</li>
        </ul>

        <h3>Tracking Payments</h3>
        <p>You can view payment status per student and per class:</p>
        <ul>
          <li><strong>Paid</strong> — Student has paid in full</li>
          <li><strong>Partial</strong> — Student has made a partial payment</li>
          <li><strong>Unpaid</strong> — No payment recorded</li>
        </ul>

        <h3>Receipts</h3>
        <p>When a payment is recorded, the system can generate a receipt. Receipts can be downloaded as PDF and include the school name, student details, payment amount, and date.</p>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Parents can also pay fees online via Paystack integration (if enabled). Payments are automatically recorded and receipts are generated.</p>
        </div>
      </>
    ),
  },
  {
    id: 'users',
    icon: <Users />,
    color: 'teal',
    title: 'User Management',
    desc: 'Creating accounts, linking parents, CSV import',
    body: (
      <>
        <h3>User Roles</h3>
        <p>The system supports these roles:</p>
        <ul>
          <li><strong>Admin</strong> — Full school management access</li>
          <li><strong>Principal</strong> — Similar to admin with some restrictions</li>
          <li><strong>Teacher</strong> — Manages assigned subjects, grades, attendance</li>
          <li><strong>Student</strong> — Views grades, takes assessments, checks fees</li>
          <li><strong>Parent</strong> — Views children's grades, pays fees, sees reports</li>
        </ul>

        <h3>Creating Users</h3>
        <ul>
          <li>Go to <strong>Users</strong> in the sidebar</li>
          <li>Select the user type you want to create</li>
          <li>Fill in the required information (name, email, etc.)</li>
          <li>For students: assign them to a class</li>
          <li>For parents: link them to their children's accounts</li>
        </ul>

        <h3>Bulk CSV Import</h3>
        <p>You can import multiple students at once using a CSV file:</p>
        <ul>
          <li>Download the CSV template from the import page</li>
          <li>Fill in student details following the template format</li>
          <li>Upload the CSV file — students are created and enrolled automatically</li>
        </ul>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>When creating a parent account, you can link them to existing student accounts. The parent will then see all linked children's data on their dashboard.</p>
        </div>
      </>
    ),
  },
  {
    id: 'reports',
    icon: <FileText />,
    color: 'red',
    title: 'Report Cards',
    desc: 'Grade computation, PDF generation, access control',
    body: (
      <>
        <h3>How Grades Are Computed</h3>
        <p>Each student's report card shows per-subject scores broken down into:</p>
        <ul>
          <li><strong>Test Score</strong> — From manual grading or online tests</li>
          <li><strong>Exam Score</strong> — From manual grading or online exams</li>
          <li><strong>Attendance Score</strong> — Automatically calculated from attendance records</li>
          <li><strong>Total</strong> — Sum of all three components</li>
          <li><strong>Grade</strong> — Letter grade based on your configured boundaries</li>
        </ul>

        <h3>Generating Report Cards</h3>
        <ul>
          <li>Go to <strong>Report Cards</strong> in the sidebar</li>
          <li>Select the class session</li>
          <li>Click <strong>Generate</strong> to create PDF report cards for all students</li>
          <li>You can also generate individual reports</li>
        </ul>

        <h3>Controlling Report Access</h3>
        <p>You can control when students and parents can view report cards:</p>
        <ul>
          <li><strong>Enable access</strong> — Students and parents can view/download reports</li>
          <li><strong>Disable access</strong> — Reports are hidden until you enable access</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Report cards can also be emailed directly to parents. Use the "Send Reports" feature to email report PDFs to all parents at once.</p>
        </div>
      </>
    ),
  },
  {
    id: 'announcements',
    icon: <Megaphone />,
    color: 'pink',
    title: 'Announcements',
    desc: 'Creating announcements, targeting, email delivery',
    body: (
      <>
        <h3>Creating Announcements</h3>
        <ul>
          <li>Go to <strong>Announcements</strong> in the sidebar</li>
          <li>Click <strong>Create Announcement</strong></li>
          <li>Enter the title and message content</li>
          <li>Choose who should see it (all users, specific roles, or specific classes)</li>
        </ul>

        <h3>Targeting Options</h3>
        <p>You can target announcements to:</p>
        <ul>
          <li><strong>Everyone</strong> — All users in the school</li>
          <li><strong>Specific roles</strong> — e.g., only teachers, only parents</li>
          <li><strong>Specific classes</strong> — e.g., only JSS1 students and parents</li>
        </ul>

        <h3>Email Delivery</h3>
        <p>When you create an announcement, it can also be sent via email to all targeted users who have email addresses on file.</p>
      </>
    ),
  },
  {
    id: 'transitions',
    icon: <ArrowRightLeft />,
    color: 'slate',
    title: 'Session Transitions',
    desc: 'Moving terms, what gets deactivated, reverting',
    body: (
      <>
        <h3>Moving to the Next Term</h3>
        <p>At the end of a term, use <strong>Session Management → Move to Next Term</strong> to transition the school:</p>
        <ul>
          <li>The current term is marked as completed</li>
          <li>The next term becomes active</li>
          <li>New class sessions are created for the new term</li>
          <li>Students are automatically enrolled in the new term</li>
          <li>Previous term's grading configuration is deactivated</li>
        </ul>

        <h3>What Gets Deactivated</h3>
        <p>When you move to a new term:</p>
        <ul>
          <li>Previous term's <strong>student sessions</strong> are marked inactive (but preserved for historical data)</li>
          <li>Previous term's <strong>grading configuration</strong> is deactivated</li>
          <li>Previous term's <strong>attendance calendar</strong> is preserved but no longer editable</li>
        </ul>

        <h3>Reverting a Transition</h3>
        <p>If you moved to the next term by mistake, you can <strong>revert</strong> back. This will:</p>
        <ul>
          <li>Reactivate the previous term's data</li>
          <li>Deactivate the new term's data</li>
        </ul>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Always ensure all grading is complete and report cards are generated before moving to the next term. Once you move, teachers can no longer edit grades for the previous term.</p>
        </div>
      </>
    ),
  },
  {
    id: 'graduation',
    icon: <GraduationCap />,
    color: 'green',
    title: 'Student Graduation',
    desc: 'What happens when final-year students graduate, grace period, account deactivation',
    body: (
      <>
        <h3>When Do Students Graduate?</h3>
        <p>Students in the school's <strong>final class</strong> are automatically graduated when you move to a new academic session. The system identifies graduating students and processes them during the session transition.</p>

        <h3>What Happens at Graduation</h3>
        <ul>
          <li>The student is marked as <strong>Graduated</strong> in the system</li>
          <li>The student receives an <strong>in-app notification</strong> and a <strong>congratulations email</strong></li>
          <li>The student's parent(s) also receive in-app and email notifications</li>
          <li>The student's account remains <strong>active for 30 days</strong> so they can download their reports</li>
        </ul>

        <h3>The 30-Day Grace Period</h3>
        <p>After graduation, students have a <strong>30-day grace period</strong> during which their account remains fully active. They can still log in to:</p>
        <ul>
          <li>Download all their report cards (any term, any year)</li>
          <li>View their attendance reports</li>
          <li>Access their academic history</li>
        </ul>
        <p>After 30 days, the student's account is automatically deactivated and they can no longer log in.</p>

        <h3>Account Deactivation</h3>
        <p>Deactivation is handled automatically by the system each day — no manual action is required from the admin.</p>
        <ul>
          <li><strong>Student accounts</strong> — deactivated exactly <strong>30 days</strong> after graduation</li>
          <li><strong>Parent accounts</strong> — deactivated <strong>3 months (90 days)</strong> after their last child's graduation, but only once all linked children have graduated</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Students receive a graduation email with the exact date their account will be deactivated and a prompt to download their reports. Parents receive an individual email per graduating child plus a separate notice (with exact deactivation date) when all their children have graduated.</p>
        </div>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Before moving to a new session, make sure all report cards for the graduating class are generated and report access is enabled, so graduating students can download their records during the grace period.</p>
        </div>
      </>
    ),
  },
];

const teacherContent = [
  {
    id: 'dashboard',
    icon: <LayoutDashboard />,
    color: 'blue',
    title: 'Dashboard Overview',
    desc: 'Your stats, assigned classes, and grading progress',
    body: (
      <>
        <h3>Your Dashboard</h3>
        <p>The dashboard shows a summary of your teaching activities:</p>
        <ul>
          <li><strong>Assigned Classes</strong> — Number of classes you teach</li>
          <li><strong>Total Students</strong> — Number of students across your classes</li>
          <li><strong>Grading Progress</strong> — How many subjects have complete grades</li>
          <li><strong>Recent Announcements</strong> — Latest school announcements</li>
        </ul>
        <p>Use the sidebar to navigate to different sections of the system.</p>
      </>
    ),
  },
  {
    id: 'assigned-classes',
    icon: <Layers />,
    color: 'purple',
    title: 'Assigned Classes & Subjects',
    desc: 'Viewing your classes and subject details',
    body: (
      <>
        <h3>Viewing Your Classes</h3>
        <p>Go to <strong>My Classes</strong> to see all classes you're assigned to. Each class shows:</p>
        <ul>
          <li>The class name and arm (e.g., JSS1A)</li>
          <li>The subjects you teach in that class</li>
          <li>Number of students enrolled</li>
        </ul>

        <h3>Subject Details</h3>
        <p>Click on a subject to view:</p>
        <ul>
          <li>Student list for that subject</li>
          <li>Current grading progress (who has scores, who doesn't)</li>
          <li>Assessment history</li>
        </ul>
      </>
    ),
  },
  {
    id: 'attendance',
    icon: <CheckSquare />,
    color: 'green',
    title: 'Attendance Marking',
    desc: 'Marking daily attendance and viewing history',
    body: (
      <>
        <h3>Marking Attendance</h3>
        <ul>
          <li>Go to <strong>Attendance</strong> in the sidebar</li>
          <li>Select the class and date</li>
          <li>Mark each student as <strong>Present</strong>, <strong>Absent</strong>, or <strong>Late</strong></li>
          <li>Click <strong>Save</strong> to record attendance</li>
        </ul>

        <h3>Viewing Attendance History</h3>
        <p>You can view past attendance records for your classes by selecting previous dates. The system shows attendance statistics per student and per class.</p>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Attendance can only be marked for dates that exist on the school's Attendance Calendar. If a date isn't showing, contact your admin to add it to the calendar.</p>
        </div>
      </>
    ),
  },
  {
    id: 'tests-exams',
    icon: <ClipboardList />,
    color: 'orange',
    title: 'Tests & Exams',
    desc: 'Creating assessments, questions, scoring, editing',
    body: (
      <>
        <h3>Creating an Assessment</h3>
        <ul>
          <li>Go to <strong>Set Test</strong> or <strong>Set Exam</strong> in the sidebar</li>
          <li>Select the subject and class</li>
          <li>Choose assessment type: <strong>Online</strong> (students take it digitally) or <strong>Manual</strong> (you enter scores)</li>
          <li>For online assessments, add questions (multiple choice, short answer, etc.)</li>
          <li>Set the total marks and deadline</li>
        </ul>

        <h3>Online Assessments</h3>
        <p>For online assessments:</p>
        <ul>
          <li>Add questions with answer options</li>
          <li>Set the correct answer for auto-grading</li>
          <li>Students access the test from their dashboard</li>
          <li>Scores are automatically calculated and recorded</li>
        </ul>

        <h3>Viewing and Editing Scores</h3>
        <p>After an assessment, view scores per student. If you need to modify a score:</p>
        <ul>
          <li>Go to the assessment's score page</li>
          <li>Click on the student's score to edit</li>
          <li>If editing is locked, request an admin to unlock it</li>
        </ul>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Scores from online assessments automatically sync to the grading system. Manual test/exam scores need to be entered through the Manual Grading section.</p>
        </div>
      </>
    ),
  },
  {
    id: 'manual-grading',
    icon: <PenTool />,
    color: 'red',
    title: 'Manual Grading',
    desc: 'Entering test and exam scores directly',
    body: (
      <>
        <h3>Entering Scores</h3>
        <ul>
          <li>Go to <strong>Manual Grading</strong> in the sidebar</li>
          <li>Select the subject and class session</li>
          <li>You'll see a list of all students in that class</li>
          <li>Enter <strong>test scores</strong> and <strong>exam scores</strong> for each student</li>
          <li>Scores must not exceed the mark allocation set by the admin</li>
          <li>Click <strong>Save</strong> to record all scores</li>
        </ul>

        <h3>Score Validation</h3>
        <p>The system validates that:</p>
        <ul>
          <li>Test scores don't exceed the test mark allocation</li>
          <li>Exam scores don't exceed the exam mark allocation</li>
          <li>Scores are non-negative numbers</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>If you've created online assessments, those scores appear automatically. You only need to manually enter scores for paper-based assessments.</p>
        </div>
      </>
    ),
  },
  {
    id: 'subject-content',
    icon: <FileEdit />,
    color: 'teal',
    title: 'Subject Content',
    desc: 'Managing learning materials and topics',
    body: (
      <>
        <h3>Managing Content</h3>
        <p>You can add learning materials for your subjects:</p>
        <ul>
          <li>Go to <strong>Subject Content</strong> in the sidebar</li>
          <li>Select the subject</li>
          <li>Add topics, notes, and learning materials</li>
          <li>Students can access these materials from their dashboard</li>
        </ul>
      </>
    ),
  },
  {
    id: 'announcements',
    icon: <Bell />,
    color: 'pink',
    title: 'Announcements',
    desc: 'Viewing school announcements',
    body: (
      <>
        <h3>Viewing Announcements</h3>
        <p>School announcements appear on your dashboard and in the <strong>Announcements</strong> section. These include:</p>
        <ul>
          <li>School-wide announcements from the admin</li>
          <li>Announcements targeted specifically to teachers</li>
          <li>Class-specific announcements for classes you teach</li>
        </ul>
        <p>You'll also receive email notifications for important announcements if your email is on file.</p>
      </>
    ),
  },
];

const studentContent = [
  {
    id: 'dashboard',
    icon: <LayoutDashboard />,
    color: 'blue',
    title: 'Dashboard Overview',
    desc: 'Your classes, grades summary, and upcoming assessments',
    body: (
      <>
        <h3>Your Dashboard</h3>
        <p>Your dashboard gives you a quick overview of:</p>
        <ul>
          <li><strong>Your Class</strong> — The class and arm you're enrolled in</li>
          <li><strong>Grade Summary</strong> — Your current average score across subjects</li>
          <li><strong>Upcoming Assessments</strong> — Tests and exams that are due</li>
          <li><strong>Attendance</strong> — Your attendance percentage for the term</li>
          <li><strong>Recent Announcements</strong> — Latest school and class announcements</li>
        </ul>
      </>
    ),
  },
  {
    id: 'grades',
    icon: <GraduationCap />,
    color: 'purple',
    title: 'My Grades',
    desc: 'Subject grades, score breakdowns, and rankings',
    body: (
      <>
        <h3>Viewing Your Grades</h3>
        <p>Go to <strong>My Grades</strong> to see your scores for each subject:</p>
        <ul>
          <li><strong>Test Score</strong> — Your test marks</li>
          <li><strong>Exam Score</strong> — Your exam marks</li>
          <li><strong>Attendance Score</strong> — Calculated from your attendance record</li>
          <li><strong>Total</strong> — Combined score</li>
          <li><strong>Grade</strong> — Your letter grade (A, B, C, etc.)</li>
        </ul>

        <h3>Subject Rankings</h3>
        <p>You can see how you rank in each subject compared to your classmates, and your overall position in the class.</p>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Grades are updated in real-time as your teachers enter scores. Your final grades are available after all assessments are complete.</p>
        </div>
      </>
    ),
  },
  {
    id: 'assessments',
    icon: <ClipboardList />,
    color: 'green',
    title: 'Taking Assessments',
    desc: 'How to take online tests and exams',
    body: (
      <>
        <h3>Available Assessments</h3>
        <p>Go to <strong>Assessments</strong> to see tests and exams assigned to you.</p>

        <h3>Taking an Online Assessment</h3>
        <div className="kb-steps">
          <div className="kb-step">
            <span className="kb-step-num">1</span>
            <span className="kb-step-text">Click on the assessment to open it</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">2</span>
            <span className="kb-step-text">Read each question carefully and select or type your answer</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">3</span>
            <span className="kb-step-text">Navigate between questions using the Next/Previous buttons</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">4</span>
            <span className="kb-step-text">Review your answers before submitting</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">5</span>
            <span className="kb-step-text">Click <strong>Submit</strong> — your score is calculated automatically</span>
          </div>
        </div>

        <h3>Viewing Results</h3>
        <p>After submitting, you can see your score and (if enabled by the teacher) the correct answers.</p>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Make sure to submit before the deadline. Once the deadline passes, you won't be able to take the assessment.</p>
        </div>
      </>
    ),
  },
  {
    id: 'attendance',
    icon: <CheckSquare />,
    color: 'orange',
    title: 'Attendance Report',
    desc: 'Viewing your attendance record',
    body: (
      <>
        <h3>Your Attendance</h3>
        <p>Go to <strong>Attendance Report</strong> to see your attendance record:</p>
        <ul>
          <li>View attendance for each day of the term</li>
          <li>See your total days present, absent, and late</li>
          <li>Your attendance percentage is calculated automatically</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Your attendance percentage may count toward your grades if the school has configured attendance scoring. Check your grade breakdown to see if attendance points are included.</p>
        </div>
      </>
    ),
  },
  {
    id: 'assignments',
    icon: <FileEdit />,
    color: 'teal',
    title: 'Assignments',
    desc: 'Viewing and submitting assignments',
    body: (
      <>
        <h3>Viewing Assignments</h3>
        <p>Go to <strong>Assignments</strong> to see work assigned by your teachers. Each assignment shows:</p>
        <ul>
          <li>Subject name</li>
          <li>Assignment title and description</li>
          <li>Due date</li>
          <li>Submission status</li>
        </ul>

        <h3>Submitting Work</h3>
        <p>Click on an assignment to view details and submit your work. You can upload files or type your response depending on the assignment type.</p>
      </>
    ),
  },
  {
    id: 'fees',
    icon: <Receipt />,
    color: 'red',
    title: 'Fee Status',
    desc: 'Checking fees and payment history',
    body: (
      <>
        <h3>Viewing Your Fees</h3>
        <p>Go to <strong>Fee Status</strong> to see:</p>
        <ul>
          <li>Total fees for the current term</li>
          <li>Amount paid so far</li>
          <li>Outstanding balance</li>
          <li>Payment history with dates and receipts</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Fee payments are managed by your school admin or parents. If you have questions about your fees, contact your school's admin office.</p>
        </div>
      </>
    ),
  },
  {
    id: 'report-card',
    icon: <Download />,
    color: 'indigo',
    title: 'Report Card',
    desc: 'Downloading your report card PDF',
    body: (
      <>
        <h3>Accessing Your Report Card</h3>
        <p>When your school admin enables report card access:</p>
        <ul>
          <li>Go to <strong>Report Card</strong> in the sidebar</li>
          <li>Select the term you want to view</li>
          <li>Click <strong>Download PDF</strong> to save your report card</li>
        </ul>

        <h3>What's on Your Report Card</h3>
        <p>Your report card includes:</p>
        <ul>
          <li>All subject scores (test, exam, attendance, total)</li>
          <li>Letter grades for each subject</li>
          <li>Class position/ranking</li>
          <li>Teacher and principal comments</li>
          <li>Attendance summary</li>
        </ul>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>If you can't see your report card, it may not have been released yet. Ask your teacher or admin when reports will be available.</p>
        </div>
      </>
    ),
  },
  {
    id: 'graduation',
    icon: <GraduationCap />,
    color: 'green',
    title: 'After Graduation',
    desc: 'What happens to your account, grace period, and downloading your records',
    body: (
      <>
        <h3>Congratulations on Graduating!</h3>
        <p>When you complete your final year and your school processes the session transition, you will be marked as a graduate. You will receive a congratulations notification and email.</p>

        <h3>Your 30-Day Grace Period</h3>
        <p>Your account will <strong>remain active for 30 days</strong> after graduation. During this time you can still log in normally to:</p>
        <ul>
          <li>Download your report cards for all terms</li>
          <li>View your attendance reports</li>
          <li>Access your full academic history</li>
        </ul>

        <h3>What to Download Before Your Account is Deactivated</h3>
        <div className="kb-steps">
          <div className="kb-step">
            <span className="kb-step-num">1</span>
            <span className="kb-step-text">Log in to your student account as normal</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">2</span>
            <span className="kb-step-text">Go to <strong>Report Card</strong> in the sidebar</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">3</span>
            <span className="kb-step-text">Download your report card PDF for each term you completed</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">4</span>
            <span className="kb-step-text">Visit <strong>Attendance Report</strong> to download your attendance records</span>
          </div>
        </div>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>After the 30-day grace period, your account will be deactivated and you will no longer be able to log in. The exact deactivation date is included in your graduation email — make sure to download all your records before that date.</p>
        </div>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Save your downloaded report cards somewhere safe — on your device, a USB drive, or cloud storage like Google Drive. These are your official academic records.</p>
        </div>
      </>
    ),
  },
];

const parentContent = [
  {
    id: 'dashboard',
    icon: <LayoutDashboard />,
    color: 'blue',
    title: 'Dashboard Overview',
    desc: 'Overview of your linked children',
    body: (
      <>
        <h3>Your Dashboard</h3>
        <p>Your parent dashboard shows an overview of all your children linked to your account:</p>
        <ul>
          <li><strong>Children Cards</strong> — Each child shows their class, current average, and attendance</li>
          <li><strong>Quick Links</strong> — Jump to grades, attendance, or fees for any child</li>
          <li><strong>Announcements</strong> — School and class announcements relevant to your children</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>If a child is missing from your dashboard, contact the school admin to link the student account to your parent account.</p>
        </div>
      </>
    ),
  },
  {
    id: 'grades',
    icon: <GraduationCap />,
    color: 'purple',
    title: "Children's Grades",
    desc: 'Academic performance per child with subject breakdowns',
    body: (
      <>
        <h3>Viewing Grades</h3>
        <p>Go to <strong>Grade Report</strong> to see each child's academic performance:</p>
        <ul>
          <li>Select the child you want to view</li>
          <li>See all subjects with test scores, exam scores, and totals</li>
          <li>View letter grades and class rankings</li>
        </ul>

        <h3>Understanding the Breakdown</h3>
        <p>Each subject's total score is composed of:</p>
        <ul>
          <li><strong>Test Score</strong> — From class tests</li>
          <li><strong>Exam Score</strong> — From end-of-term exams</li>
          <li><strong>Attendance Score</strong> — Based on attendance record</li>
        </ul>
        <p>The total of these components determines the letter grade.</p>
      </>
    ),
  },
  {
    id: 'attendance',
    icon: <CheckSquare />,
    color: 'green',
    title: 'Attendance Reports',
    desc: "Monitoring each child's attendance",
    body: (
      <>
        <h3>Viewing Attendance</h3>
        <p>Go to <strong>Attendance Report</strong> to monitor your child's school attendance:</p>
        <ul>
          <li>Select the child</li>
          <li>View daily attendance records (present, absent, late)</li>
          <li>See overall attendance percentage for the term</li>
        </ul>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Regular attendance can affect your child's grades if the school includes attendance in their grading. Check the grade breakdown to see attendance scores.</p>
        </div>
      </>
    ),
  },
  {
    id: 'fees',
    icon: <DollarSign />,
    color: 'orange',
    title: 'Fee Status & Payments',
    desc: 'Viewing fees, paying online, downloading receipts',
    body: (
      <>
        <h3>Viewing Fees</h3>
        <p>Go to <strong>Fee Status</strong> to see fees for each child:</p>
        <ul>
          <li>Total fees for the current term</li>
          <li>Amount paid and outstanding balance</li>
          <li>Fee breakdown by type (tuition, lab fees, etc.)</li>
        </ul>

        <h3>Making Payments</h3>
        <p>If online payments are enabled, you can pay directly through the platform:</p>
        <div className="kb-steps">
          <div className="kb-step">
            <span className="kb-step-num">1</span>
            <span className="kb-step-text">Select the child and fee to pay</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">2</span>
            <span className="kb-step-text">Enter the payment amount (full or partial)</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">3</span>
            <span className="kb-step-text">Complete payment via Paystack (card, bank transfer, etc.)</span>
          </div>
          <div className="kb-step">
            <span className="kb-step-num">4</span>
            <span className="kb-step-text">A receipt is generated automatically after successful payment</span>
          </div>
        </div>

        <h3>Downloading Receipts</h3>
        <p>After payment, you can download PDF receipts from the payment history section.</p>
      </>
    ),
  },
  {
    id: 'announcements',
    icon: <Bell />,
    color: 'pink',
    title: 'Announcements',
    desc: 'School-wide and class-specific announcements',
    body: (
      <>
        <h3>Viewing Announcements</h3>
        <p>You'll see announcements relevant to you and your children:</p>
        <ul>
          <li><strong>School-wide</strong> — General announcements for all parents</li>
          <li><strong>Class-specific</strong> — Announcements for your child's class</li>
          <li><strong>Direct</strong> — Messages targeted at parents specifically</li>
        </ul>
        <p>Important announcements may also be sent to your email address.</p>
      </>
    ),
  },
  {
    id: 'reports',
    icon: <FileText />,
    color: 'indigo',
    title: 'Report Cards',
    desc: "Accessing and downloading children's reports",
    body: (
      <>
        <h3>Viewing Report Cards</h3>
        <p>When the school releases report cards:</p>
        <ul>
          <li>Go to <strong>Report Card</strong> in the sidebar</li>
          <li>Select the child</li>
          <li>Choose the term</li>
          <li>Click <strong>Download PDF</strong> to save the report</li>
        </ul>

        <h3>Report Card Contents</h3>
        <p>Each report card includes:</p>
        <ul>
          <li>Full subject grades and scores</li>
          <li>Class position and ranking</li>
          <li>Teacher and principal remarks</li>
          <li>Attendance summary</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Report cards are only available when the school admin enables access. If you can't see reports, they may not have been released yet.</p>
        </div>
      </>
    ),
  },
  {
    id: 'graduation',
    icon: <GraduationCap />,
    color: 'green',
    title: "Your Child's Graduation",
    desc: 'What happens when your child graduates, grace period, and downloading records',
    body: (
      <>
        <h3>When Your Child Graduates</h3>
        <p>When your child completes their final year, the school will process graduation as part of the session transition. You will receive both an <strong>in-app notification</strong> and a <strong>congratulations email</strong> informing you of your child's graduation.</p>

        <h3>The 30-Day Grace Period</h3>
        <p>Your child's student account will remain active for <strong>30 days</strong> after graduation. During this period, your child can still log in and download their academic records. After 30 days, the student account is automatically deactivated.</p>

        <h3>What Your Child Should Download</h3>
        <p>Please remind your child to log in to their student account and download the following before the account is deactivated:</p>
        <ul>
          <li>Report cards for all completed terms</li>
          <li>Attendance reports</li>
          <li>Any other academic records they may need for future reference (e.g., for higher institution applications)</li>
        </ul>

        <h3>Your Parent Account</h3>
        <p>Your parent account remains active after your child graduates and stays accessible during the student's 30-day grace period. However, once <strong>all</strong> of your linked children have graduated, your parent account will also be deactivated — <strong>3 months after the last child's graduation date</strong>.</p>
        <p>When that happens, you will receive a separate email with the exact date your account will be deactivated.</p>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>If you have multiple children, your parent account will not be deactivated until all of them have graduated. As long as one child is still enrolled, your account remains fully active.</p>
        </div>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Help your child save their downloaded report cards in a safe place (USB drive, Google Drive, email) as these serve as their official academic records for university applications and employment. You have up to 3 months after their graduation to access historical records from your parent portal.</p>
        </div>
      </>
    ),
  },
];

const principalContent = [
  {
    id: 'getting-started',
    icon: <Rocket />,
    color: 'indigo',
    title: 'Getting Started',
    desc: 'Understanding your role and access level',
    body: (
      <>
        <h3>Your Role as Principal</h3>
        <p>As a principal, you have access to most school management features similar to an admin. You can:</p>
        <ul>
          <li>View and manage classes, subjects, and sessions</li>
          <li>Monitor grading progress across all classes</li>
          <li>View attendance records and statistics</li>
          <li>Manage fee structures and track payments</li>
          <li>Generate and manage report cards</li>
          <li>Create and manage announcements</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Some advanced settings (like session transitions and certain configurations) may require admin-level access. Contact your school admin for those operations.</p>
        </div>
      </>
    ),
  },
  {
    id: 'class-session',
    icon: <Layers />,
    color: 'blue',
    title: 'Class & Session Management',
    desc: 'Viewing classes, sessions, and enrollments',
    body: (
      <>
        <h3>Viewing Sessions</h3>
        <p>Go to <strong>Session Management</strong> to see the current academic year and term. You can view all terms and their status.</p>

        <h3>Viewing Classes</h3>
        <p>Navigate to <strong>Classes</strong> to see all classes in the school, including:</p>
        <ul>
          <li>Class names and arms</li>
          <li>Number of students per class</li>
          <li>Subjects assigned to each class</li>
          <li>Teachers assigned to each subject</li>
        </ul>
      </>
    ),
  },
  {
    id: 'subjects',
    icon: <BookOpenCheck />,
    color: 'green',
    title: 'Subject Management',
    desc: 'Viewing subjects, teachers, and departments',
    body: (
      <>
        <h3>Subject Overview</h3>
        <p>Go to <strong>Subjects</strong> to see all subjects organized by class:</p>
        <ul>
          <li>Subject name and department</li>
          <li>Assigned teacher</li>
          <li>Number of enrolled students</li>
          <li>Grading progress (complete/incomplete)</li>
        </ul>

        <h3>Managing Subjects</h3>
        <p>You can add, edit, and remove subjects from class sessions, as well as reassign teachers to subjects.</p>
      </>
    ),
  },
  {
    id: 'grading',
    icon: <Settings />,
    color: 'purple',
    title: 'Grading Configuration',
    desc: 'Viewing and managing mark allocations',
    body: (
      <>
        <h3>Grading Setup</h3>
        <p>View the current grading configuration under <strong>Settings → Grading</strong>:</p>
        <ul>
          <li>Test mark allocation</li>
          <li>Exam mark allocation</li>
          <li>Attendance mark allocation</li>
          <li>Grade boundaries (A, B, C, etc.)</li>
        </ul>
        <p>You can modify these settings for the current term. Changes affect how scores are calculated for all subjects.</p>
      </>
    ),
  },
  {
    id: 'attendance',
    icon: <Calendar />,
    color: 'orange',
    title: 'Attendance Overview',
    desc: 'School-wide attendance monitoring',
    body: (
      <>
        <h3>Monitoring Attendance</h3>
        <p>View attendance records across all classes:</p>
        <ul>
          <li>Overall attendance rate per class</li>
          <li>Individual student attendance records</li>
          <li>Attendance trends over the term</li>
          <li>Attendance calendar for the current term</li>
        </ul>
      </>
    ),
  },
  {
    id: 'fees',
    icon: <DollarSign />,
    color: 'green',
    title: 'Fee Management',
    desc: 'Fee structures, payment tracking, receipts',
    body: (
      <>
        <h3>Fee Overview</h3>
        <p>Go to <strong>Fees</strong> to manage school fees:</p>
        <ul>
          <li>View all fee structures and amounts per class</li>
          <li>Track payment status (paid, partial, unpaid)</li>
          <li>Generate and manage payment receipts</li>
          <li>View fee collection summary reports</li>
        </ul>
      </>
    ),
  },
  {
    id: 'reports',
    icon: <FileText />,
    color: 'red',
    title: 'Report Cards',
    desc: 'Generating and managing student reports',
    body: (
      <>
        <h3>Report Management</h3>
        <p>Go to <strong>Report Cards</strong> to:</p>
        <ul>
          <li>Generate PDF report cards for individual students or entire classes</li>
          <li>Control report access for students and parents</li>
          <li>Send report cards via email to parents</li>
          <li>Add principal's comments to reports</li>
        </ul>

        <div className="kb-tip">
          <Lightbulb className="kb-tip-icon" />
          <p>Review grading completion across all classes before generating reports. Incomplete grades will show as missing on the report card.</p>
        </div>
      </>
    ),
  },
  {
    id: 'announcements',
    icon: <Megaphone />,
    color: 'pink',
    title: 'Announcements',
    desc: 'Creating and managing school announcements',
    body: (
      <>
        <h3>Creating Announcements</h3>
        <p>Go to <strong>Announcements</strong> to create and manage school announcements:</p>
        <ul>
          <li>Create new announcements with title and content</li>
          <li>Target specific roles or classes</li>
          <li>Announcements can be sent via email</li>
          <li>View and manage existing announcements</li>
        </ul>
      </>
    ),
  },
  {
    id: 'graduation',
    icon: <GraduationCap />,
    color: 'green',
    title: 'Student Graduation',
    desc: 'What happens when final-year students graduate, grace periods, account deactivation',
    body: (
      <>
        <h3>When Do Students Graduate?</h3>
        <p>Students in the school's <strong>final class</strong> are automatically graduated when the admin moves to a new academic session. The system identifies graduating students and processes them during the session transition.</p>

        <h3>What Happens at Graduation</h3>
        <ul>
          <li>The student is marked as <strong>Graduated</strong> in the system</li>
          <li>The student and their parent(s) receive <strong>in-app notifications</strong> and <strong>congratulations emails</strong></li>
          <li>The student's account remains <strong>active for 30 days</strong> to allow report downloads</li>
          <li>The parent's account remains active until <strong>3 months after their last child's graduation</strong></li>
        </ul>

        <h3>Student Account — 30-Day Grace Period</h3>
        <p>After graduation, students can still log in for 30 days to download their report cards, attendance records, and other academic data. After 30 days, the account is automatically deactivated by the system.</p>

        <h3>Parent Account — 3-Month Grace Period</h3>
        <p>Parent accounts are deactivated 3 months after all their children have graduated. If a parent still has an active (non-graduated) child enrolled, their account remains fully active. The parent receives a specific email with the exact date their account will be deactivated.</p>

        <h3>Automatic Deactivation</h3>
        <p>Deactivation runs automatically every day — no action is required from you or the admin:</p>
        <ul>
          <li><strong>Students</strong> — deactivated 30 days after graduation date</li>
          <li><strong>Parents</strong> — deactivated 90 days after their last child's graduation date</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Students and parents are clearly notified via email of their account deactivation dates. As principal, ensure all report cards are generated and report access is enabled before the session transition so students can download their records during the grace period.</p>
        </div>
      </>
    ),
  },
];

const proprietorContent = [
  {
    id: 'analytics',
    icon: <BarChart3 />,
    color: 'blue',
    title: 'Analytics Dashboard',
    desc: 'Revenue, attendance trends, and data quality',
    body: (
      <>
        <h3>Overview</h3>
        <p>Your analytics dashboard provides a high-level view of school operations:</p>
        <ul>
          <li><strong>Revenue Metrics</strong> — Total fees collected, outstanding balances, collection rate</li>
          <li><strong>Attendance Trends</strong> — Average attendance rate across classes over time</li>
          <li><strong>Data Quality</strong> — Completeness of grading, student records, and fee tracking</li>
        </ul>

        <h3>Using Filters</h3>
        <p>Use the session and term filters to view analytics for specific periods. You can compare current term performance against previous terms.</p>
      </>
    ),
  },
  {
    id: 'performance',
    icon: <TrendingUp />,
    color: 'purple',
    title: 'Performance Monitoring',
    desc: 'Academic performance across sessions',
    body: (
      <>
        <h3>Academic Performance</h3>
        <p>The performance tab shows:</p>
        <ul>
          <li>Average scores per class and subject</li>
          <li>Performance trends across terms</li>
          <li>Class-by-class comparisons</li>
          <li>Subject performance rankings</li>
        </ul>

        <h3>Identifying Areas for Improvement</h3>
        <p>Use the performance data to identify:</p>
        <ul>
          <li>Subjects with consistently low scores</li>
          <li>Classes that may need additional support</li>
          <li>Positive trends to celebrate and reinforce</li>
        </ul>
      </>
    ),
  },
  {
    id: 'configuration',
    icon: <Building2 />,
    color: 'green',
    title: 'School Configuration',
    desc: 'Branding, subscription, and settings',
    body: (
      <>
        <h3>School Branding</h3>
        <p>Customize your school's appearance in the system:</p>
        <ul>
          <li>Upload your school logo</li>
          <li>Set school name and motto</li>
          <li>Configure school colors</li>
          <li>These appear on report cards, receipts, and the student portal</li>
        </ul>

        <h3>Subscription Management</h3>
        <p>View and manage your subscription plan:</p>
        <ul>
          <li>Current plan and feature limits</li>
          <li>Upgrade or change plans</li>
          <li>Payment history and invoices</li>
        </ul>

        <div className="kb-note">
          <Info className="kb-note-icon" />
          <p>Your subscription plan determines the number of students, teachers, and features available. Contact support if you need a custom plan.</p>
        </div>
      </>
    ),
  },
];

// ─── Role-to-content map ─────────────────────────────────────────────

const roleContentMap = {
  admin: { title: 'Admin User Guide', desc: 'Everything you need to manage your school', sections: adminContent },
  teacher: { title: 'Teacher User Guide', desc: 'Guides for teaching and grading', sections: teacherContent },
  student: { title: 'Student User Guide', desc: 'Help with your school experience', sections: studentContent },
  parent: { title: 'Parent User Guide', desc: "Stay informed about your child's education", sections: parentContent },
  principal: { title: 'Principal User Guide', desc: 'School management at a glance', sections: principalContent },
  proprietor: { title: 'Proprietor User Guide', desc: 'Monitor and configure your school', sections: proprietorContent },
};

// ─── Component ───────────────────────────────────────────────────────

export default function UserGuide({ userRole }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSection, setOpenSection] = useState(null);

  const roleData = roleContentMap[userRole] || roleContentMap.admin;

  // Filter sections by search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return roleData.sections;
    const q = searchQuery.toLowerCase();
    return roleData.sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [searchQuery, roleData.sections]);

  const toggleSection = (id) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div className="kb-container">
      {/* Header */}
      <div className="kb-header">
        <h1>{roleData.title}</h1>
        <p>{roleData.desc}</p>
      </div>

      {/* Breadcrumb */}
      {openSection && (
        <div className="kb-breadcrumb">
          <button className="kb-breadcrumb-link" onClick={() => setOpenSection(null)}>
            User Guide
          </button>
          <span className="kb-breadcrumb-sep">/</span>
          <span className="kb-breadcrumb-current">
            {roleData.sections.find((s) => s.id === openSection)?.title}
          </span>
        </div>
      )}

      {/* Search */}
      <div className="kb-search">
        <Search className="kb-search-icon" />
        <input
          type="text"
          placeholder="Search topics..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOpenSection(null);
          }}
        />
        {searchQuery && (
          <button className="kb-search-clear" onClick={() => setSearchQuery('')}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Sections */}
      {filteredSections.length === 0 ? (
        <div className="kb-no-results">
          <HelpCircle className="kb-no-results-icon" />
          <h3>No results found</h3>
          <p>Try a different search term</p>
        </div>
      ) : (
        <div className="kb-sections">
          {filteredSections.map((section) => (
            <div
              key={section.id}
              className={`kb-section${openSection === section.id ? ' kb-section-open' : ''}`}
            >
              <button className="kb-section-header" onClick={() => toggleSection(section.id)}>
                <div className={`kb-section-icon ${section.color}`}>{section.icon}</div>
                <div className="kb-section-info">
                  <h2 className="kb-section-title">{section.title}</h2>
                  <p className="kb-section-desc">{section.desc}</p>
                </div>
                <ChevronDown className="kb-section-chevron" />
              </button>
              <div className="kb-section-content">
                <div className="kb-section-body">{section.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
