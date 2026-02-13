"""
Proprietor analytics API views.
These are school-scoped endpoints requiring proprietor role authentication.
"""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status, permissions
from django.db.models import Count, Sum, Avg, Q, F
from django.utils import timezone
from datetime import timedelta

from users.models import CustomUser
from academics.models import Department, Class, ClassSession, StudentSession, Subject
from schooladmin.models import (
    GradeSummary, GradingConfiguration, FeeStructure, StudentFeeRecord,
    AttendanceRecord, FeePaymentHistory,
)
from logs.models import ActivityLog


class IsProprietorRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'proprietor'


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_dashboard(request):
    """Main dashboard stats: user counts, students by department/class."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    current_year = school.current_academic_year
    current_term = school.current_term

    # User counts
    user_counts = (
        CustomUser.objects.filter(school=school, is_active=True)
        .values('role')
        .annotate(count=Count('id'))
    )
    counts = {row['role']: row['count'] for row in user_counts}
    teachers_count = counts.get('teacher', 0)
    students_count = counts.get('student', 0)

    # Students by department
    departments = Department.objects.filter(school=school).order_by('name')
    dept_data = []
    for dept in departments:
        student_count = CustomUser.objects.filter(
            school=school, role='student', is_active=True, department=dept.name
        ).count()
        dept_data.append({'name': dept.name, 'student_count': student_count})

    # Students by class (current session)
    classes = Class.objects.filter(school=school).order_by('name')
    class_data = []
    total_class_students = 0
    for cls in classes:
        try:
            cs = ClassSession.objects.get(
                classroom=cls, academic_year=current_year, term=current_term
            )
            student_count = StudentSession.objects.filter(
                class_session=cs, is_active=True
            ).count()
        except ClassSession.DoesNotExist:
            student_count = 0
        class_data.append({'name': cls.name, 'student_count': student_count})
        total_class_students += student_count

    # ========== NEW METRICS ==========

    # 1. Gender Distribution
    gender_counts = (
        CustomUser.objects.filter(school=school, role='student', is_active=True)
        .values('gender')
        .annotate(count=Count('id'))
    )
    gender_data = {row['gender'] or 'Unknown': row['count'] for row in gender_counts}

    # 2. Teacher-to-Student Ratio
    teacher_student_ratio = round(students_count / teachers_count, 1) if teachers_count > 0 else 0

    # 3. Average Class Size
    active_classes = len([c for c in class_data if c['student_count'] > 0])
    avg_class_size = round(total_class_students / active_classes, 1) if active_classes > 0 else 0

    # 4. Fee Collection Progress (current term)
    fee_structures = FeeStructure.objects.filter(
        school=school, academic_year=current_year, term=current_term
    )
    fee_records = StudentFeeRecord.objects.filter(fee_structure__in=fee_structures)
    fee_agg = fee_records.aggregate(
        total_expected=Sum('fee_structure__amount'),
        total_collected=Sum('amount_paid'),
    )
    total_expected = float(fee_agg['total_expected'] or 0)
    total_collected = float(fee_agg['total_collected'] or 0)
    collection_rate = round((total_collected / total_expected) * 100, 1) if total_expected > 0 else 0

    fee_progress = {
        'total_expected': total_expected,
        'total_collected': total_collected,
        'outstanding': max(total_expected - total_collected, 0),
        'collection_rate': collection_rate,
    }

    # 5. Subjects Without Teachers
    subjects_without_teacher = Subject.objects.filter(
        class_session__classroom__school=school,
        class_session__academic_year=current_year,
        class_session__term=current_term,
        teacher__isnull=True
    ).count()

    # 6. Top Performing Classes (by average score)
    top_classes = []
    configs = GradingConfiguration.objects.filter(
        school=school, academic_year=current_year, term=current_term, is_active=True
    )
    if configs.exists():
        class_sessions = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=current_year,
            term=current_term
        ).select_related('classroom')

        for cs in class_sessions:
            # Get average score for this class
            class_avg = GradeSummary.objects.filter(
                grading_config__in=configs,
                student__in=StudentSession.objects.filter(
                    class_session=cs, is_active=True
                ).values('student'),
                total_score__isnull=False
            ).aggregate(avg=Avg('total_score'))['avg']

            if class_avg:
                top_classes.append({
                    'name': cs.classroom.name,
                    'average_score': round(class_avg, 1),
                })

        # Sort by average score descending, take top 5
        top_classes.sort(key=lambda x: x['average_score'], reverse=True)
        top_classes = top_classes[:5]

    # 7. Term-over-Term Comparison
    # Determine previous term
    term_order = ['First Term', 'Second Term', 'Third Term']
    current_term_idx = term_order.index(current_term) if current_term in term_order else 0

    if current_term_idx > 0:
        prev_term = term_order[current_term_idx - 1]
        prev_year = current_year
    else:
        prev_term = 'Third Term'
        # Parse year like "2024/2025" and go back one year
        try:
            years = current_year.split('/')
            prev_year = f"{int(years[0]) - 1}/{int(years[1]) - 1}"
        except:
            prev_year = current_year

    # Previous term enrollment
    prev_enrollment = 0
    prev_class_sessions = ClassSession.objects.filter(
        classroom__school=school,
        academic_year=prev_year,
        term=prev_term
    )
    for pcs in prev_class_sessions:
        prev_enrollment += StudentSession.objects.filter(
            class_session=pcs, is_active=True
        ).count()

    # Previous term revenue
    prev_fee_structures = FeeStructure.objects.filter(
        school=school, academic_year=prev_year, term=prev_term
    )
    prev_fee_records = StudentFeeRecord.objects.filter(fee_structure__in=prev_fee_structures)
    prev_collected = float(prev_fee_records.aggregate(total=Sum('amount_paid'))['total'] or 0)

    # Previous term pass rate
    prev_configs = GradingConfiguration.objects.filter(
        school=school, academic_year=prev_year, term=prev_term
    )
    prev_pass_rate = 0
    if prev_configs.exists():
        prev_summaries = GradeSummary.objects.filter(
            grading_config__in=prev_configs,
            student__school=school,
            total_score__isnull=False
        )
        prev_student_avgs = prev_summaries.values('student').annotate(avg=Avg('total_score'))
        prev_total = prev_student_avgs.count()
        prev_passed = prev_student_avgs.filter(avg__gte=40).count()
        prev_pass_rate = round((prev_passed / prev_total) * 100, 1) if prev_total > 0 else 0

    # Current term pass rate
    current_pass_rate = 0
    if configs.exists():
        current_summaries = GradeSummary.objects.filter(
            grading_config__in=configs,
            student__school=school,
            total_score__isnull=False
        )
        current_student_avgs = current_summaries.values('student').annotate(avg=Avg('total_score'))
        current_total = current_student_avgs.count()
        current_passed = current_student_avgs.filter(avg__gte=40).count()
        current_pass_rate = round((current_passed / current_total) * 100, 1) if current_total > 0 else 0

    term_comparison = {
        'current': {
            'session': current_year,
            'term': current_term,
            'enrollment': total_class_students,
            'revenue': total_collected,
            'pass_rate': current_pass_rate,
        },
        'previous': {
            'session': prev_year,
            'term': prev_term,
            'enrollment': prev_enrollment,
            'revenue': prev_collected,
            'pass_rate': prev_pass_rate,
        },
        'changes': {
            'enrollment': total_class_students - prev_enrollment,
            'enrollment_pct': round(((total_class_students - prev_enrollment) / prev_enrollment) * 100, 1) if prev_enrollment > 0 else 0,
            'revenue': total_collected - prev_collected,
            'revenue_pct': round(((total_collected - prev_collected) / prev_collected) * 100, 1) if prev_collected > 0 else 0,
            'pass_rate': round(current_pass_rate - prev_pass_rate, 1),
        }
    }

    # 8. Students with Outstanding Fees (upcoming deadlines)
    students_with_debt = StudentFeeRecord.objects.filter(
        fee_structure__in=fee_structures,
        amount_paid__lt=F('fee_structure__amount')
    ).select_related('student', 'fee_structure')[:10]

    upcoming_fees = []
    for record in students_with_debt:
        outstanding = float(record.fee_structure.amount) - float(record.amount_paid)
        upcoming_fees.append({
            'student_id': record.student.id,
            'student_name': f"{record.student.first_name} {record.student.last_name}",
            'fee_name': record.fee_structure.name,
            'outstanding': outstanding,
        })

    # 9. Recent Activity Feed
    recent_activities = []
    try:
        activities = ActivityLog.objects.filter(
            school=school
        ).select_related('user').order_by('-timestamp')[:10]

        for activity in activities:
            recent_activities.append({
                'id': activity.id,
                'action': activity.action or activity.activity_type,
                'user': f"{activity.user.first_name} {activity.user.last_name}" if activity.user else 'System',
                'details': activity.content_title or '',
                'timestamp': activity.timestamp.isoformat(),
            })
    except Exception as e:
        # ActivityLog might not exist or have different fields
        pass

    return Response({
        'teachers_count': teachers_count,
        'students_count': students_count,
        'parents_count': counts.get('parent', 0),
        'principals_count': counts.get('principal', 0),
        'departments': dept_data,
        'classes': class_data,
        # New metrics
        'gender_distribution': gender_data,
        'teacher_student_ratio': teacher_student_ratio,
        'avg_class_size': avg_class_size,
        'fee_progress': fee_progress,
        'subjects_without_teacher': subjects_without_teacher,
        'top_performing_classes': top_classes,
        'term_comparison': term_comparison,
        'upcoming_fees': upcoming_fees,
        'recent_activities': recent_activities,
        'current_session': current_year,
        'current_term': current_term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_sessions(request):
    """Available sessions/terms for filter dropdowns."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    sessions = (
        ClassSession.objects.filter(classroom__school=school)
        .values('academic_year', 'term')
        .distinct()
        .order_by('-academic_year', 'term')
    )

    return Response({
        'sessions': list(sessions),
        'current_session': school.current_academic_year,
        'current_term': school.current_term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_performance(request):
    """Performance comparison between terms: pass/fail rates, averages."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    compare_session = request.query_params.get('compare_session')
    compare_term = request.query_params.get('compare_term')

    def get_term_stats(academic_year, term_name):
        if not academic_year or not term_name:
            return None

        configs = GradingConfiguration.objects.filter(
            school=school, academic_year=academic_year, term=term_name
        )
        if not configs.exists():
            return {
                'session': academic_year, 'term': term_name,
                'total_students': 0, 'passed': 0, 'failed': 0,
                'average_score': 0, 'pass_rate': 0,
            }

        # Get grade summaries that are finalized
        summaries = GradeSummary.objects.filter(
            grading_config__in=configs,
            student__school=school,
            total_score__isnull=False,
        )

        # Get unique students with their average total_score
        student_averages = (
            summaries.values('student')
            .annotate(avg_score=Avg('total_score'))
        )

        total_students = student_averages.count()
        if total_students == 0:
            return {
                'session': academic_year, 'term': term_name,
                'total_students': 0, 'passed': 0, 'failed': 0,
                'average_score': 0, 'pass_rate': 0,
            }

        # Use 40% as default pass mark
        passed = student_averages.filter(avg_score__gte=40).count()
        failed = total_students - passed
        overall_avg = student_averages.aggregate(avg=Avg('avg_score'))['avg'] or 0

        return {
            'session': academic_year,
            'term': term_name,
            'total_students': total_students,
            'passed': passed,
            'failed': failed,
            'average_score': round(overall_avg, 1),
            'pass_rate': round((passed / total_students) * 100, 1) if total_students > 0 else 0,
        }

    current = get_term_stats(session, term)
    comparison = get_term_stats(compare_session, compare_term)

    return Response({
        'current': current,
        'comparison': comparison,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_performance_details(request):
    """
    Detailed performance analytics including:
    - Performance by class
    - Performance by subject
    - Performance by department
    - Grade distribution
    - Top performers
    - Students at risk
    - Performance trends
    - Teacher performance
    - Exam vs CA analysis

    Supports comparison with another term via compare_session and compare_term params.
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    compare_session = request.query_params.get('compare_session')
    compare_term = request.query_params.get('compare_term')

    configs = GradingConfiguration.objects.filter(
        school=school, academic_year=session, term=term
    )

    empty_response = {
        'performance_by_class': [],
        'performance_by_subject': [],
        'performance_by_department': [],
        'grade_distribution': [],
        'top_performers': [],
        'students_at_risk': [],
        'performance_trends': [],
        'teacher_performance': [],
        'exam_vs_ca': None,
        'session': session,
        'term': term,
        'comparison': None,
    }

    if not configs.exists():
        return Response(empty_response)

    # Get all grade summaries for this term
    summaries = GradeSummary.objects.filter(
        grading_config__in=configs,
        student__school=school,
        total_score__isnull=False
    ).select_related('student', 'subject', 'grading_config')

    # 1. Performance by Class
    class_sessions = ClassSession.objects.filter(
        classroom__school=school,
        academic_year=session,
        term=term
    ).select_related('classroom')

    performance_by_class = []
    for cs in class_sessions:
        # Get students in this class
        student_ids = StudentSession.objects.filter(
            class_session=cs
        ).values_list('student_id', flat=True)

        if not student_ids:
            continue

        # Get their grade summaries
        class_summaries = summaries.filter(student_id__in=student_ids)
        if not class_summaries.exists():
            continue

        # Calculate class stats
        student_avgs = class_summaries.values('student').annotate(avg=Avg('total_score'))
        total = student_avgs.count()
        passed = student_avgs.filter(avg__gte=40).count()
        avg_score = student_avgs.aggregate(overall=Avg('avg'))['overall'] or 0

        performance_by_class.append({
            'class_name': cs.classroom.name,
            'total_students': total,
            'passed': passed,
            'failed': total - passed,
            'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
            'average_score': round(avg_score, 1),
        })

    # Sort by average score descending
    performance_by_class.sort(key=lambda x: x['average_score'], reverse=True)

    # 2. Performance by Subject
    subjects = Subject.objects.filter(
        class_session__classroom__school=school,
        class_session__academic_year=session,
        class_session__term=term
    ).select_related('teacher')

    performance_by_subject = []
    subject_stats = {}  # To aggregate by subject name

    for subject in subjects:
        subject_summaries = summaries.filter(subject=subject)
        if not subject_summaries.exists():
            continue

        total = subject_summaries.count()
        passed = subject_summaries.filter(total_score__gte=40).count()
        avg_score = subject_summaries.aggregate(avg=Avg('total_score'))['avg'] or 0

        # Aggregate by subject name
        if subject.name not in subject_stats:
            subject_stats[subject.name] = {
                'subject_name': subject.name,
                'total_students': 0,
                'passed': 0,
                'total_score': 0,
                'count': 0,
            }
        subject_stats[subject.name]['total_students'] += total
        subject_stats[subject.name]['passed'] += passed
        subject_stats[subject.name]['total_score'] += avg_score * total
        subject_stats[subject.name]['count'] += total

    for name, stats in subject_stats.items():
        total = stats['total_students']
        passed = stats['passed']
        avg = stats['total_score'] / stats['count'] if stats['count'] > 0 else 0
        performance_by_subject.append({
            'subject_name': name,
            'total_students': total,
            'passed': passed,
            'failed': total - passed,
            'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
            'average_score': round(avg, 1),
        })

    performance_by_subject.sort(key=lambda x: x['average_score'], reverse=True)

    # 3. Performance by Department
    performance_by_department = []
    departments = ['Science', 'Arts', 'Commercial']

    for dept in departments:
        dept_students = CustomUser.objects.filter(
            school=school, role='student', is_active=True, department=dept
        ).values_list('id', flat=True)

        if not dept_students:
            continue

        dept_summaries = summaries.filter(student_id__in=dept_students)
        if not dept_summaries.exists():
            continue

        student_avgs = dept_summaries.values('student').annotate(avg=Avg('total_score'))
        total = student_avgs.count()
        passed = student_avgs.filter(avg__gte=40).count()
        avg_score = student_avgs.aggregate(overall=Avg('avg'))['overall'] or 0

        performance_by_department.append({
            'department': dept,
            'total_students': total,
            'passed': passed,
            'failed': total - passed,
            'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
            'average_score': round(avg_score, 1),
        })

    # 4. Grade Distribution
    grade_distribution = []

    # Get the grading scale from config
    config = configs.first()
    if config and config.grading_scale:
        scale = config.grading_scale
        # Build grade ranges from GradingScale model's fields
        grade_ranges = [
            ('A', scale.a_min_score, 100),
            ('B', scale.b_min_score, scale.a_min_score - 1),
            ('C', scale.c_min_score, scale.b_min_score - 1),
            ('D', scale.d_min_score, scale.c_min_score - 1),
            ('F', 0, scale.d_min_score - 1),
        ]

        for grade, min_s, max_s in grade_ranges:
            count = summaries.filter(
                total_score__gte=min_s,
                total_score__lte=max_s
            ).count()
            grade_distribution.append({
                'grade': grade,
                'count': count,
                'min_score': min_s,
                'max_score': max_s,
            })
    else:
        # Default grade ranges
        default_ranges = [
            ('A', 70, 100),
            ('B', 60, 69),
            ('C', 50, 59),
            ('D', 40, 49),
            ('F', 0, 39),
        ]
        for grade, min_s, max_s in default_ranges:
            count = summaries.filter(
                total_score__gte=min_s,
                total_score__lte=max_s
            ).count()
            grade_distribution.append({
                'grade': grade,
                'count': count,
                'min_score': min_s,
                'max_score': max_s,
            })

    # 5. Top Performers (Top 20 students)
    student_averages = (
        summaries.values('student__id', 'student__first_name', 'student__last_name', 'student__department')
        .annotate(avg_score=Avg('total_score'))
        .order_by('-avg_score')[:20]
    )

    top_performers = []
    for idx, row in enumerate(student_averages):
        # Get student's class
        class_name = ''
        try:
            ss = StudentSession.objects.filter(
                student_id=row['student__id'],
                class_session__academic_year=session,
                class_session__term=term
            ).select_related('class_session__classroom').first()
            if ss:
                class_name = ss.class_session.classroom.name
        except:
            pass

        top_performers.append({
            'rank': idx + 1,
            'student_id': row['student__id'],
            'name': f"{row['student__first_name']} {row['student__last_name']}",
            'class': class_name,
            'department': row['student__department'] or '',
            'average_score': round(row['avg_score'], 1),
        })

    # 6. Students at Risk (scoring 40-50%)
    at_risk_students = (
        summaries.values('student__id', 'student__first_name', 'student__last_name', 'student__department')
        .annotate(avg_score=Avg('total_score'))
        .filter(avg_score__gte=40, avg_score__lt=50)
        .order_by('avg_score')[:20]
    )

    students_at_risk = []
    for row in at_risk_students:
        class_name = ''
        try:
            ss = StudentSession.objects.filter(
                student_id=row['student__id'],
                class_session__academic_year=session,
                class_session__term=term
            ).select_related('class_session__classroom').first()
            if ss:
                class_name = ss.class_session.classroom.name
        except:
            pass

        students_at_risk.append({
            'student_id': row['student__id'],
            'name': f"{row['student__first_name']} {row['student__last_name']}",
            'class': class_name,
            'department': row['student__department'] or '',
            'average_score': round(row['avg_score'], 1),
        })

    # 7. Performance Trends (across terms)
    performance_trends = []
    all_sessions = (
        ClassSession.objects.filter(classroom__school=school)
        .values('academic_year', 'term')
        .distinct()
        .order_by('academic_year', 'term')
    )

    term_order = {'First Term': 1, 'Second Term': 2, 'Third Term': 3}
    sorted_sessions = sorted(
        all_sessions,
        key=lambda x: (x['academic_year'], term_order.get(x['term'], 0))
    )[-6:]  # Last 6 terms

    for sess in sorted_sessions:
        sess_configs = GradingConfiguration.objects.filter(
            school=school,
            academic_year=sess['academic_year'],
            term=sess['term']
        )
        if not sess_configs.exists():
            continue

        sess_summaries = GradeSummary.objects.filter(
            grading_config__in=sess_configs,
            student__school=school,
            total_score__isnull=False
        )

        student_avgs = sess_summaries.values('student').annotate(avg=Avg('total_score'))
        total = student_avgs.count()
        if total == 0:
            continue

        passed = student_avgs.filter(avg__gte=40).count()
        avg_score = student_avgs.aggregate(overall=Avg('avg'))['overall'] or 0

        performance_trends.append({
            'session': sess['academic_year'],
            'term': sess['term'],
            'label': f"{sess['term'][:1]}T {sess['academic_year'].split('/')[0][-2:]}",
            'pass_rate': round((passed / total) * 100, 1),
            'average_score': round(avg_score, 1),
            'total_students': total,
        })

    # 8. Teacher Performance
    teacher_performance = []
    teachers = CustomUser.objects.filter(school=school, role='teacher', is_active=True)

    for teacher in teachers:
        # Get subjects taught by this teacher
        teacher_subjects = Subject.objects.filter(
            teacher=teacher,
            class_session__academic_year=session,
            class_session__term=term
        )

        if not teacher_subjects.exists():
            continue

        teacher_summaries = summaries.filter(subject__in=teacher_subjects)
        if not teacher_summaries.exists():
            continue

        total = teacher_summaries.count()
        passed = teacher_summaries.filter(total_score__gte=40).count()
        avg_score = teacher_summaries.aggregate(avg=Avg('total_score'))['avg'] or 0

        teacher_performance.append({
            'teacher_id': teacher.id,
            'teacher_name': f"{teacher.first_name} {teacher.last_name}",
            'subjects_count': teacher_subjects.count(),
            'students_graded': total,
            'passed': passed,
            'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
            'average_score': round(avg_score, 1),
        })

    teacher_performance.sort(key=lambda x: x['average_score'], reverse=True)

    # 9. Exam vs CA Analysis
    exam_vs_ca = None
    if summaries.exists():
        # Get average exam scores and CA scores
        agg = summaries.aggregate(
            avg_exam=Avg('exam_score'),
            avg_test=Avg('test_score'),
            avg_assignment=Avg('assignment_score'),
            avg_attendance=Avg('attendance_score'),
        )

        # Get the config percentages
        config = configs.first()
        exam_pct = config.exam_percentage if config else 60
        test_pct = config.test_percentage if config else 20
        assignment_pct = config.assignment_percentage if config else 15
        attendance_pct = config.attendance_percentage if config else 5

        # Calculate weighted scores (normalize to 100)
        exam_normalized = (float(agg['avg_exam'] or 0) / exam_pct * 100) if exam_pct > 0 else 0
        ca_components = []
        if test_pct > 0 and agg['avg_test']:
            ca_components.append(float(agg['avg_test']))
        if assignment_pct > 0 and agg['avg_assignment']:
            ca_components.append(float(agg['avg_assignment']))
        if attendance_pct > 0 and agg['avg_attendance']:
            ca_components.append(float(agg['avg_attendance']))

        ca_total_pct = test_pct + assignment_pct + attendance_pct
        ca_avg = sum(ca_components)
        ca_normalized = (ca_avg / ca_total_pct * 100) if ca_total_pct > 0 else 0

        exam_vs_ca = {
            'exam_average': round(exam_normalized, 1),
            'ca_average': round(ca_normalized, 1),
            'exam_weight': exam_pct,
            'ca_weight': ca_total_pct,
            'components': {
                'test': round(float(agg['avg_test'] or 0), 1),
                'assignment': round(float(agg['avg_assignment'] or 0), 1),
                'attendance': round(float(agg['avg_attendance'] or 0), 1),
            },
            'component_weights': {
                'test': test_pct,
                'assignment': assignment_pct,
                'attendance': attendance_pct,
            }
        }

    # Calculate comparison data if comparison parameters provided
    comparison = None
    if compare_session and compare_term:
        comp_configs = GradingConfiguration.objects.filter(
            school=school, academic_year=compare_session, term=compare_term
        )

        if comp_configs.exists():
            comp_summaries = GradeSummary.objects.filter(
                grading_config__in=comp_configs,
                student__school=school,
                total_score__isnull=False
            ).select_related('student', 'subject', 'grading_config')

            # Comparison by class
            comp_class_sessions = ClassSession.objects.filter(
                classroom__school=school,
                academic_year=compare_session,
                term=compare_term
            ).select_related('classroom')

            comp_by_class = {}
            for cs in comp_class_sessions:
                student_ids = StudentSession.objects.filter(
                    class_session=cs
                ).values_list('student_id', flat=True)

                if not student_ids:
                    continue

                class_summaries = comp_summaries.filter(student_id__in=student_ids)
                if not class_summaries.exists():
                    continue

                student_avgs = class_summaries.values('student').annotate(avg=Avg('total_score'))
                total = student_avgs.count()
                passed = student_avgs.filter(avg__gte=40).count()
                avg_score = student_avgs.aggregate(overall=Avg('avg'))['overall'] or 0

                comp_by_class[cs.classroom.name] = {
                    'total_students': total,
                    'passed': passed,
                    'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
                    'average_score': round(avg_score, 1),
                }

            # Comparison by subject
            comp_subjects = Subject.objects.filter(
                class_session__classroom__school=school,
                class_session__academic_year=compare_session,
                class_session__term=compare_term
            )

            comp_subject_stats = {}
            for subject in comp_subjects:
                subject_summaries = comp_summaries.filter(subject=subject)
                if not subject_summaries.exists():
                    continue

                total = subject_summaries.count()
                passed = subject_summaries.filter(total_score__gte=40).count()
                avg_score = subject_summaries.aggregate(avg=Avg('total_score'))['avg'] or 0

                if subject.name not in comp_subject_stats:
                    comp_subject_stats[subject.name] = {
                        'total_students': 0, 'passed': 0, 'total_score': 0, 'count': 0,
                    }
                comp_subject_stats[subject.name]['total_students'] += total
                comp_subject_stats[subject.name]['passed'] += passed
                comp_subject_stats[subject.name]['total_score'] += avg_score * total
                comp_subject_stats[subject.name]['count'] += total

            comp_by_subject = {}
            for name, stats in comp_subject_stats.items():
                total = stats['total_students']
                passed = stats['passed']
                avg = stats['total_score'] / stats['count'] if stats['count'] > 0 else 0
                comp_by_subject[name] = {
                    'total_students': total,
                    'passed': passed,
                    'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
                    'average_score': round(avg, 1),
                }

            # Comparison by department
            comp_by_department = {}
            for dept in ['Science', 'Arts', 'Commercial']:
                dept_students = CustomUser.objects.filter(
                    school=school, role='student', is_active=True, department=dept
                ).values_list('id', flat=True)

                if not dept_students:
                    continue

                dept_summaries = comp_summaries.filter(student_id__in=dept_students)
                if not dept_summaries.exists():
                    continue

                student_avgs = dept_summaries.values('student').annotate(avg=Avg('total_score'))
                total = student_avgs.count()
                passed = student_avgs.filter(avg__gte=40).count()
                avg_score = student_avgs.aggregate(overall=Avg('avg'))['overall'] or 0

                comp_by_department[dept] = {
                    'total_students': total,
                    'passed': passed,
                    'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
                    'average_score': round(avg_score, 1),
                }

            # Comparison grade distribution
            comp_config = comp_configs.first()
            comp_grade_dist = {}
            if comp_config and comp_config.grading_scale:
                scale = comp_config.grading_scale
                grade_ranges = [
                    ('A', scale.a_min_score, 100),
                    ('B', scale.b_min_score, scale.a_min_score - 1),
                    ('C', scale.c_min_score, scale.b_min_score - 1),
                    ('D', scale.d_min_score, scale.c_min_score - 1),
                    ('F', 0, scale.d_min_score - 1),
                ]
            else:
                grade_ranges = [('A', 70, 100), ('B', 60, 69), ('C', 50, 59), ('D', 40, 49), ('F', 0, 39)]

            for grade, min_s, max_s in grade_ranges:
                count = comp_summaries.filter(total_score__gte=min_s, total_score__lte=max_s).count()
                comp_grade_dist[grade] = count

            # Comparison teacher performance
            comp_by_teacher = {}
            for teacher in CustomUser.objects.filter(school=school, role='teacher', is_active=True):
                teacher_subjects = Subject.objects.filter(
                    teacher=teacher,
                    class_session__academic_year=compare_session,
                    class_session__term=compare_term
                )
                if not teacher_subjects.exists():
                    continue

                teacher_summaries = comp_summaries.filter(subject__in=teacher_subjects)
                if not teacher_summaries.exists():
                    continue

                total = teacher_summaries.count()
                passed = teacher_summaries.filter(total_score__gte=40).count()
                avg_score = teacher_summaries.aggregate(avg=Avg('total_score'))['avg'] or 0

                comp_by_teacher[teacher.id] = {
                    'pass_rate': round((passed / total) * 100, 1) if total > 0 else 0,
                    'average_score': round(avg_score, 1),
                }

            # Comparison exam vs CA
            comp_exam_vs_ca = None
            if comp_summaries.exists():
                agg = comp_summaries.aggregate(
                    avg_exam=Avg('exam_score'),
                    avg_test=Avg('test_score'),
                    avg_assignment=Avg('assignment_score'),
                    avg_attendance=Avg('attendance_score'),
                )
                exam_pct = comp_config.exam_percentage if comp_config else 60
                test_pct = comp_config.test_percentage if comp_config else 20
                assignment_pct = comp_config.assignment_percentage if comp_config else 15
                attendance_pct = comp_config.attendance_percentage if comp_config else 5

                exam_normalized = (float(agg['avg_exam'] or 0) / exam_pct * 100) if exam_pct > 0 else 0
                ca_components = []
                if test_pct > 0 and agg['avg_test']:
                    ca_components.append(float(agg['avg_test']))
                if assignment_pct > 0 and agg['avg_assignment']:
                    ca_components.append(float(agg['avg_assignment']))
                if attendance_pct > 0 and agg['avg_attendance']:
                    ca_components.append(float(agg['avg_attendance']))
                ca_total_pct = test_pct + assignment_pct + attendance_pct
                ca_avg = sum(ca_components)
                ca_normalized = (ca_avg / ca_total_pct * 100) if ca_total_pct > 0 else 0

                comp_exam_vs_ca = {
                    'exam_average': round(exam_normalized, 1),
                    'ca_average': round(ca_normalized, 1),
                }

            comparison = {
                'session': compare_session,
                'term': compare_term,
                'by_class': comp_by_class,
                'by_subject': comp_by_subject,
                'by_department': comp_by_department,
                'grade_distribution': comp_grade_dist,
                'by_teacher': comp_by_teacher,
                'exam_vs_ca': comp_exam_vs_ca,
            }

    return Response({
        'performance_by_class': performance_by_class,
        'performance_by_subject': performance_by_subject,
        'performance_by_department': performance_by_department,
        'grade_distribution': grade_distribution,
        'top_performers': top_performers,
        'students_at_risk': students_at_risk,
        'performance_trends': performance_trends,
        'teacher_performance': teacher_performance,
        'exam_vs_ca': exam_vs_ca,
        'session': session,
        'term': term,
        'comparison': comparison,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_revenue(request):
    """Revenue comparison between terms."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    compare_session = request.query_params.get('compare_session')
    compare_term = request.query_params.get('compare_term')

    def get_revenue_stats(academic_year, term_name):
        if not academic_year or not term_name:
            return None

        fee_structures = FeeStructure.objects.filter(
            school=school, academic_year=academic_year, term=term_name
        )

        records = StudentFeeRecord.objects.filter(fee_structure__in=fee_structures)
        agg = records.aggregate(
            total_fees=Sum('fee_structure__amount'),
            total_paid=Sum('amount_paid'),
        )

        total_fees = float(agg['total_fees'] or 0)
        collected = float(agg['total_paid'] or 0)
        outstanding = total_fees - collected

        return {
            'session': academic_year,
            'term': term_name,
            'total_fees': total_fees,
            'collected': collected,
            'outstanding': max(outstanding, 0),
            'collection_rate': round((collected / total_fees) * 100, 1) if total_fees > 0 else 0,
        }

    current = get_revenue_stats(session, term)
    comparison = get_revenue_stats(compare_session, compare_term)

    return Response({
        'current': current,
        'comparison': comparison,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_revenue_by_class(request):
    """Revenue breakdown by class for a given term."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)

    if not session or not term:
        return Response({
            'classes': [],
            'total_collected': 0,
            'total_outstanding': 0,
            'session': session,
            'term': term,
        })

    # Get all classes for this school
    classes = Class.objects.filter(school=school).order_by('name')

    class_revenue = []
    total_collected = 0
    total_outstanding = 0

    for cls in classes:
        # Get fee structures for this class, session, and term
        fee_structures = FeeStructure.objects.filter(
            school=school,
            academic_year=session,
            term=term,
            classes=cls
        )

        if not fee_structures.exists():
            continue

        # Get all student fee records for these structures
        records = StudentFeeRecord.objects.filter(fee_structure__in=fee_structures)

        # Calculate totals
        class_total_fees = 0
        class_collected = 0

        for record in records:
            class_total_fees += float(record.fee_structure.amount)
            class_collected += float(record.amount_paid)

        class_outstanding = max(class_total_fees - class_collected, 0)

        if class_total_fees > 0:  # Only include classes with fees
            class_revenue.append({
                'name': cls.name,
                'collected': class_collected,
                'outstanding': class_outstanding,
                'total': class_total_fees,
                'students_count': records.count(),
            })
            total_collected += class_collected
            total_outstanding += class_outstanding

    # Sort by total fees descending for better visualization
    class_revenue.sort(key=lambda x: x['total'], reverse=True)

    return Response({
        'classes': class_revenue,
        'total_collected': total_collected,
        'total_outstanding': total_outstanding,
        'total_fees': total_collected + total_outstanding,
        'session': session,
        'term': term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_revenue_details(request):
    """
    Comprehensive revenue analytics including:
    - Overview metrics (total expected, collected, outstanding, collection rate)
    - Revenue by class with collection rates
    - Collection trend over time
    - Fee type breakdown
    - Top debtors
    - Recent payments
    - Aging report
    - Term comparison support
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    compare_session = request.query_params.get('compare_session')
    compare_term = request.query_params.get('compare_term')

    # Get fee structures for current term
    fee_structures = FeeStructure.objects.filter(
        school=school, academic_year=session, term=term
    )

    if not fee_structures.exists():
        return Response({
            'overview': {
                'total_expected': 0,
                'total_collected': 0,
                'outstanding': 0,
                'collection_rate': 0,
                'total_students': 0,
                'fully_paid': 0,
                'partial_paid': 0,
                'unpaid': 0,
            },
            'revenue_by_class': [],
            'collection_trend': [],
            'fee_type_breakdown': [],
            'top_debtors': [],
            'recent_payments': [],
            'aging_report': [],
            'class_collection_rates': [],
            'comparison': None,
            'session': session,
            'term': term,
        })

    # Get all student fee records
    records = StudentFeeRecord.objects.filter(
        fee_structure__in=fee_structures
    ).select_related('student', 'fee_structure', 'student__classroom')

    # 1. Overview Metrics
    total_expected = 0
    total_collected = 0
    fully_paid = 0
    partial_paid = 0
    unpaid = 0

    for record in records:
        total_expected += float(record.fee_structure.amount)
        total_collected += float(record.amount_paid)
        if record.payment_status == 'PAID':
            fully_paid += 1
        elif record.payment_status == 'PARTIAL':
            partial_paid += 1
        else:
            unpaid += 1

    outstanding = max(total_expected - total_collected, 0)
    collection_rate = round((total_collected / total_expected) * 100, 1) if total_expected > 0 else 0

    overview = {
        'total_expected': total_expected,
        'total_collected': total_collected,
        'outstanding': outstanding,
        'collection_rate': collection_rate,
        'total_students': records.count(),
        'fully_paid': fully_paid,
        'partial_paid': partial_paid,
        'unpaid': unpaid,
    }

    # 2. Revenue by Class
    classes = Class.objects.filter(school=school).order_by('name')
    revenue_by_class = []

    for cls in classes:
        class_structures = fee_structures.filter(classes=cls)
        if not class_structures.exists():
            continue

        class_records = records.filter(fee_structure__in=class_structures)
        class_expected = sum(float(r.fee_structure.amount) for r in class_records)
        class_collected = sum(float(r.amount_paid) for r in class_records)
        class_outstanding = max(class_expected - class_collected, 0)

        if class_expected > 0:
            revenue_by_class.append({
                'class_name': cls.name,
                'expected': class_expected,
                'collected': class_collected,
                'outstanding': class_outstanding,
                'collection_rate': round((class_collected / class_expected) * 100, 1),
                'student_count': class_records.values('student').distinct().count(),
            })

    revenue_by_class.sort(key=lambda x: x['collected'], reverse=True)

    # 3. Collection Trend (daily collections for the last 30 days)
    thirty_days_ago = timezone.now() - timedelta(days=30)
    payment_history = FeePaymentHistory.objects.filter(
        fee_record__fee_structure__in=fee_structures,
        transaction_type='payment',
        transaction_date__gte=thirty_days_ago
    ).order_by('transaction_date')

    # Group by date
    from collections import defaultdict
    daily_collections = defaultdict(float)
    for payment in payment_history:
        date_key = payment.transaction_date.strftime('%Y-%m-%d')
        daily_collections[date_key] += float(payment.amount)

    collection_trend = [
        {'date': date, 'amount': amount}
        for date, amount in sorted(daily_collections.items())
    ]

    # 4. Fee Type Breakdown
    fee_type_breakdown = []
    for fs in fee_structures:
        fs_records = records.filter(fee_structure=fs)
        fs_expected = float(fs.amount) * fs_records.count()
        fs_collected = sum(float(r.amount_paid) for r in fs_records)

        fee_type_breakdown.append({
            'fee_name': fs.name,
            'expected': fs_expected,
            'collected': fs_collected,
            'outstanding': max(fs_expected - fs_collected, 0),
            'student_count': fs_records.count(),
        })

    fee_type_breakdown.sort(key=lambda x: x['expected'], reverse=True)

    # 5. Top Debtors (students with highest outstanding)
    student_debts = {}
    for record in records:
        student_id = record.student.id
        debt = float(record.fee_structure.amount) - float(record.amount_paid)
        if debt > 0:
            if student_id not in student_debts:
                student_debts[student_id] = {
                    'student_id': student_id,
                    'student_name': f"{record.student.first_name} {record.student.last_name}",
                    'class_name': record.student.classroom.name if record.student.classroom else 'N/A',
                    'total_outstanding': 0,
                    'fees_count': 0,
                }
            student_debts[student_id]['total_outstanding'] += debt
            student_debts[student_id]['fees_count'] += 1

    top_debtors = sorted(
        student_debts.values(),
        key=lambda x: x['total_outstanding'],
        reverse=True
    )[:20]

    # 6. Recent Payments (last 20)
    recent_payments_qs = FeePaymentHistory.objects.filter(
        fee_record__fee_structure__in=fee_structures,
        transaction_type='payment'
    ).select_related(
        'fee_record__student', 'fee_record__fee_structure'
    ).order_by('-transaction_date')[:20]

    recent_payments = []
    for payment in recent_payments_qs:
        recent_payments.append({
            'student_name': f"{payment.fee_record.student.first_name} {payment.fee_record.student.last_name}",
            'fee_name': payment.fee_record.fee_structure.name,
            'amount': float(payment.amount),
            'date': payment.transaction_date.isoformat(),
            'payment_method': payment.payment_method or 'N/A',
        })

    # 7. Aging Report (how long fees have been outstanding)
    now = timezone.now()
    aging_buckets = {
        '0-30': {'label': '0-30 days', 'count': 0, 'amount': 0},
        '31-60': {'label': '31-60 days', 'count': 0, 'amount': 0},
        '61-90': {'label': '61-90 days', 'count': 0, 'amount': 0},
        '90+': {'label': '90+ days', 'count': 0, 'amount': 0},
    }

    for record in records:
        if record.payment_status in ['UNPAID', 'PARTIAL']:
            debt = float(record.fee_structure.amount) - float(record.amount_paid)
            if debt <= 0:
                continue

            days_old = (now - record.fee_structure.date_created).days

            if days_old <= 30:
                bucket = '0-30'
            elif days_old <= 60:
                bucket = '31-60'
            elif days_old <= 90:
                bucket = '61-90'
            else:
                bucket = '90+'

            aging_buckets[bucket]['count'] += 1
            aging_buckets[bucket]['amount'] += debt

    aging_report = list(aging_buckets.values())

    # 8. Class Collection Rates (ranked)
    class_collection_rates = sorted(
        [c for c in revenue_by_class if c['expected'] > 0],
        key=lambda x: x['collection_rate'],
        reverse=True
    )

    # 9. Comparison Data
    comparison = None
    if compare_session and compare_term:
        comp_structures = FeeStructure.objects.filter(
            school=school, academic_year=compare_session, term=compare_term
        )
        if comp_structures.exists():
            comp_records = StudentFeeRecord.objects.filter(fee_structure__in=comp_structures)

            comp_expected = 0
            comp_collected = 0
            comp_fully_paid = 0
            comp_partial = 0
            comp_unpaid = 0

            for record in comp_records:
                comp_expected += float(record.fee_structure.amount)
                comp_collected += float(record.amount_paid)
                if record.payment_status == 'PAID':
                    comp_fully_paid += 1
                elif record.payment_status == 'PARTIAL':
                    comp_partial += 1
                else:
                    comp_unpaid += 1

            comp_outstanding = max(comp_expected - comp_collected, 0)

            comparison = {
                'session': compare_session,
                'term': compare_term,
                'total_expected': comp_expected,
                'total_collected': comp_collected,
                'outstanding': comp_outstanding,
                'collection_rate': round((comp_collected / comp_expected) * 100, 1) if comp_expected > 0 else 0,
                'total_students': comp_records.count(),
                'fully_paid': comp_fully_paid,
                'partial_paid': comp_partial,
                'unpaid': comp_unpaid,
            }

    return Response({
        'overview': overview,
        'revenue_by_class': revenue_by_class,
        'collection_trend': collection_trend,
        'fee_type_breakdown': fee_type_breakdown,
        'top_debtors': top_debtors,
        'recent_payments': recent_payments,
        'aging_report': aging_report,
        'class_collection_rates': class_collection_rates,
        'comparison': comparison,
        'session': session,
        'term': term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_attendance_analytics(request):
    """Attendance analytics: average rate, at-risk students, class rankings."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    pass_threshold = float(request.query_params.get('threshold', 50))  # Default 50%

    if not session or not term:
        return Response({
            'average_rate': 0,
            'total_students': 0,
            'students_at_risk': 0,
            'classes': [],
            'at_risk_students': [],
            'session': session,
            'term': term,
        })

    # Get all class sessions for this term
    class_sessions = ClassSession.objects.filter(
        classroom__school=school,
        academic_year=session,
        term=term
    ).select_related('classroom')

    if not class_sessions.exists():
        return Response({
            'average_rate': 0,
            'total_students': 0,
            'students_at_risk': 0,
            'classes': [],
            'at_risk_students': [],
            'session': session,
            'term': term,
        })

    # Calculate attendance per class
    class_attendance = []
    all_student_rates = []
    students_at_risk = []

    for cs in class_sessions:
        # Get all attendance records for this class session
        records = AttendanceRecord.objects.filter(class_session=cs)

        if not records.exists():
            continue

        # Get unique students in this class session
        student_ids = records.values_list('student_id', flat=True).distinct()
        total_students = len(set(student_ids))

        if total_students == 0:
            continue

        # Calculate attendance for each student
        class_total_rate = 0
        for student_id in set(student_ids):
            student_records = records.filter(student_id=student_id)
            total_days = student_records.count()
            present_days = student_records.filter(is_present=True).count()

            if total_days > 0:
                rate = (present_days / total_days) * 100
                all_student_rates.append(rate)
                class_total_rate += rate

                if rate < pass_threshold:
                    # Get student info
                    student = student_records.first().student
                    students_at_risk.append({
                        'id': student.id,
                        'name': f"{student.first_name} {student.last_name}",
                        'class': cs.classroom.name,
                        'attendance_rate': round(rate, 1),
                        'present_days': present_days,
                        'total_days': total_days,
                    })

        # Calculate class average
        class_avg = class_total_rate / total_students if total_students > 0 else 0

        class_attendance.append({
            'name': cs.classroom.name,
            'attendance_rate': round(class_avg, 1),
            'total_students': total_students,
            'has_departments': cs.classroom.has_departments,
        })

    # Sort classes by attendance rate (ascending - lowest first)
    class_attendance.sort(key=lambda x: x['attendance_rate'])

    # Sort at-risk students by attendance rate (ascending)
    students_at_risk.sort(key=lambda x: x['attendance_rate'])

    # Calculate overall average
    overall_average = sum(all_student_rates) / len(all_student_rates) if all_student_rates else 0

    return Response({
        'average_rate': round(overall_average, 1),
        'total_students': len(all_student_rates),
        'students_at_risk': len(students_at_risk),
        'pass_threshold': pass_threshold,
        'classes': class_attendance,
        'at_risk_students': students_at_risk[:20],  # Top 20 at-risk students
        'session': session,
        'term': term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_failed_students(request):
    """Drill-down list of failed students for a given term."""
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)

    configs = GradingConfiguration.objects.filter(
        school=school, academic_year=session, term=term
    )

    if not configs.exists():
        return Response({'students': []})

    # Get students with average score < 40
    student_averages = (
        GradeSummary.objects.filter(
            grading_config__in=configs,
            student__school=school,
            total_score__isnull=False,
        )
        .values('student__id', 'student__first_name', 'student__last_name',
                'student__department')
        .annotate(avg_score=Avg('total_score'))
        .filter(avg_score__lt=40)
        .order_by('avg_score')
    )

    students = []
    for row in student_averages:
        # Get the student's class
        student_id = row['student__id']
        class_name = ''
        try:
            ss = StudentSession.objects.filter(
                student_id=student_id, is_active=True
            ).select_related('class_session__classroom').first()
            if ss:
                class_name = ss.class_session.classroom.name
        except Exception:
            pass

        students.append({
            'id': student_id,
            'name': f"{row['student__first_name']} {row['student__last_name']}",
            'class': class_name,
            'department': row['student__department'] or '',
            'average_score': round(row['avg_score'], 1),
        })

    return Response({'students': students})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_data_quality(request):
    """
    Data quality metrics that could affect school inspections.
    Returns counts and details of data gaps.
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)

    issues = []

    # 1. Incomplete Student Records
    # Students missing critical info (class, gender, DOB for students in active sessions)
    active_students = CustomUser.objects.filter(
        school=school, role='student', is_active=True
    )

    students_no_class = active_students.filter(classroom__isnull=True).count()
    students_no_gender = active_students.filter(
        Q(gender__isnull=True) | Q(gender='')
    ).count()
    students_no_dob = active_students.filter(date_of_birth__isnull=True).count()

    # Students in department-based classes without department
    dept_classes = Class.objects.filter(school=school, has_departments=True)
    students_in_dept_classes = active_students.filter(classroom__in=dept_classes)
    students_no_department = students_in_dept_classes.filter(
        Q(department__isnull=True) | Q(department='')
    ).count()

    incomplete_students = students_no_class + students_no_gender + students_no_dob + students_no_department

    if incomplete_students > 0:
        details = []
        if students_no_class > 0:
            details.append(f"{students_no_class} without class")
        if students_no_gender > 0:
            details.append(f"{students_no_gender} without gender")
        if students_no_dob > 0:
            details.append(f"{students_no_dob} without DOB")
        if students_no_department > 0:
            details.append(f"{students_no_department} without department")

        issues.append({
            'category': 'incomplete_students',
            'label': 'Incomplete Student Records',
            'count': incomplete_students,
            'severity': 'high' if incomplete_students > 10 else 'medium',
            'details': details,
            'icon': 'user',
        })

    # 2. Missing Attendance Days
    # Check if attendance calendar exists and compare with actual records
    from attendance.models import AttendanceCalendar, AttendanceSchoolDay

    try:
        calendar = AttendanceCalendar.objects.get(
            school=school, academic_year=session, term=term
        )
        total_school_days = calendar.school_days.count()

        # Get class sessions for this term
        class_sessions = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=session,
            term=term
        )

        classes_missing_attendance = 0
        total_missing_days = 0

        for cs in class_sessions:
            # Get students in this class session
            student_sessions = StudentSession.objects.filter(
                class_session=cs, is_active=True
            )
            if not student_sessions.exists():
                continue

            # Check how many days have attendance recorded
            recorded_dates = AttendanceRecord.objects.filter(
                class_session=cs
            ).values('date').distinct().count()

            if recorded_dates < total_school_days:
                classes_missing_attendance += 1
                total_missing_days += (total_school_days - recorded_dates)

        if classes_missing_attendance > 0:
            issues.append({
                'category': 'missing_attendance',
                'label': 'Missing Attendance Days',
                'count': total_missing_days,
                'severity': 'high' if total_missing_days > 20 else 'medium',
                'details': [f"{classes_missing_attendance} classes with gaps"],
                'icon': 'calendar',
            })
    except AttendanceCalendar.DoesNotExist:
        # No calendar set up
        issues.append({
            'category': 'missing_attendance',
            'label': 'Missing Attendance Days',
            'count': 0,
            'severity': 'low',
            'details': ['No attendance calendar set up for this term'],
            'icon': 'calendar',
        })

    # 3. Unsubmitted Results
    # Students enrolled in class sessions without grade summaries
    configs = GradingConfiguration.objects.filter(
        school=school, academic_year=session, term=term
    )

    if configs.exists():
        class_sessions = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=session,
            term=term
        ).select_related('classroom')

        students_without_grades = 0
        subjects_without_grades = 0

        for cs in class_sessions:
            # Get students in this class
            student_sessions = StudentSession.objects.filter(
                class_session=cs, is_active=True
            ).select_related('student')

            # Get subjects for this class
            subjects = Subject.objects.filter(class_session=cs)

            for ss in student_sessions:
                student = ss.student
                for subject in subjects:
                    # Check if grade summary exists
                    has_grade = GradeSummary.objects.filter(
                        student=student,
                        subject=subject,
                        grading_config__in=configs,
                        total_score__isnull=False
                    ).exists()

                    if not has_grade:
                        subjects_without_grades += 1

        # Estimate unique students without complete grades
        unique_students_checked = set()
        for cs in class_sessions:
            student_sessions = StudentSession.objects.filter(
                class_session=cs, is_active=True
            )
            for ss in student_sessions:
                if ss.student_id not in unique_students_checked:
                    unique_students_checked.add(ss.student_id)
                    # Check if this student has any missing grades
                    subjects = Subject.objects.filter(class_session=cs)
                    for subject in subjects:
                        has_grade = GradeSummary.objects.filter(
                            student=ss.student,
                            subject=subject,
                            grading_config__in=configs,
                            total_score__isnull=False
                        ).exists()
                        if not has_grade:
                            students_without_grades += 1
                            break

        if subjects_without_grades > 0:
            issues.append({
                'category': 'unsubmitted_results',
                'label': 'Unsubmitted Results',
                'count': subjects_without_grades,
                'severity': 'high' if subjects_without_grades > 20 else 'medium',
                'details': [f"{students_without_grades} students affected"],
                'icon': 'clipboard',
            })
    else:
        issues.append({
            'category': 'unsubmitted_results',
            'label': 'Unsubmitted Results',
            'count': 0,
            'severity': 'low',
            'details': ['No grading configuration for this term'],
            'icon': 'clipboard',
        })

    # 4. Inactive Teachers with Assigned Classes
    inactive_teachers = CustomUser.objects.filter(
        school=school, role='teacher', is_active=False
    )

    teachers_with_subjects = 0
    affected_subjects = 0

    for teacher in inactive_teachers:
        # Check if this inactive teacher has subjects assigned for current term
        active_subjects = Subject.objects.filter(
            teacher=teacher,
            class_session__academic_year=session,
            class_session__term=term
        ).count()

        if active_subjects > 0:
            teachers_with_subjects += 1
            affected_subjects += active_subjects

    if teachers_with_subjects > 0:
        issues.append({
            'category': 'inactive_teachers',
            'label': 'Inactive Teachers with Classes',
            'count': teachers_with_subjects,
            'severity': 'high',
            'details': [f"{affected_subjects} subjects affected"],
            'icon': 'user-x',
        })

    # 5. Students without Parents linked
    students_no_parent = active_students.filter(parents__isnull=True).count()

    if students_no_parent > 0:
        issues.append({
            'category': 'orphan_students',
            'label': 'Students without Parent Link',
            'count': students_no_parent,
            'severity': 'medium' if students_no_parent > 10 else 'low',
            'details': ['Parent contact may be unavailable'],
            'icon': 'users',
        })

    # Calculate total issues and overall health score
    total_issues = sum(issue['count'] for issue in issues)
    high_severity = sum(1 for issue in issues if issue['severity'] == 'high')
    medium_severity = sum(1 for issue in issues if issue['severity'] == 'medium')

    # Health score: 100 = perfect, decreases based on issues
    health_score = 100
    health_score -= high_severity * 15
    health_score -= medium_severity * 5
    health_score -= min(total_issues // 10, 30)  # Cap at 30 points for volume
    health_score = max(health_score, 0)

    return Response({
        'issues': issues,
        'total_issues': total_issues,
        'health_score': health_score,
        'session': session,
        'term': term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_attendance_details(request):
    """
    Comprehensive attendance analytics including:
    - Overview metrics (overall rate, total students, at-risk count)
    - Attendance by class (ranked)
    - Daily/weekly patterns
    - Attendance trends over time
    - Students with chronic absenteeism
    - Comparison support
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    compare_session = request.query_params.get('compare_session')
    compare_term = request.query_params.get('compare_term')

    from attendance.models import AttendanceCalendar, AttendanceSchoolDay
    from collections import defaultdict

    empty_response = {
        'overview': {
            'average_rate': 0,
            'total_students': 0,
            'excellent_count': 0,
            'good_count': 0,
            'at_risk_count': 0,
            'chronic_absent_count': 0,
            'total_school_days': 0,
            'days_recorded': 0,
        },
        'attendance_by_class': [],
        'daily_pattern': [],
        'weekly_pattern': [],
        'attendance_trend': [],
        'chronic_absentees': [],
        'top_attendees': [],
        'comparison': None,
        'session': session,
        'term': term,
    }

    # Get class sessions for this term
    class_sessions = ClassSession.objects.filter(
        classroom__school=school,
        academic_year=session,
        term=term
    ).select_related('classroom')

    if not class_sessions.exists():
        return Response(empty_response)

    # Get total school days from calendar
    total_school_days = 0
    try:
        calendar = AttendanceCalendar.objects.get(
            school=school, academic_year=session, term=term
        )
        total_school_days = calendar.school_days.count()
    except AttendanceCalendar.DoesNotExist:
        pass

    # Calculate attendance metrics
    all_student_data = []  # List of (student_id, name, class, rate, present, total)
    class_attendance = []
    daily_counts = defaultdict(lambda: {'present': 0, 'total': 0})
    weekly_counts = defaultdict(lambda: {'present': 0, 'total': 0})

    for cs in class_sessions:
        records = AttendanceRecord.objects.filter(class_session=cs)
        if not records.exists():
            continue

        student_ids = records.values_list('student_id', flat=True).distinct()
        class_total_rate = 0
        class_student_count = 0

        for student_id in set(student_ids):
            student_records = records.filter(student_id=student_id)
            total_days = student_records.count()
            present_days = student_records.filter(is_present=True).count()

            if total_days > 0:
                rate = (present_days / total_days) * 100
                student = student_records.first().student
                all_student_data.append({
                    'student_id': student_id,
                    'name': f"{student.first_name} {student.last_name}",
                    'class_name': cs.classroom.name,
                    'rate': round(rate, 1),
                    'present_days': present_days,
                    'total_days': total_days,
                })
                class_total_rate += rate
                class_student_count += 1

        # Daily and weekly patterns
        for record in records:
            date_key = record.date.strftime('%Y-%m-%d')
            day_name = record.date.strftime('%A')
            daily_counts[date_key]['total'] += 1
            weekly_counts[day_name]['total'] += 1
            if record.is_present:
                daily_counts[date_key]['present'] += 1
                weekly_counts[day_name]['present'] += 1

        # Class average
        if class_student_count > 0:
            class_avg = class_total_rate / class_student_count
            class_attendance.append({
                'class_name': cs.classroom.name,
                'attendance_rate': round(class_avg, 1),
                'student_count': class_student_count,
            })

    # Sort classes by attendance rate
    class_attendance.sort(key=lambda x: x['attendance_rate'], reverse=True)

    # Calculate overview metrics
    total_students = len(all_student_data)
    avg_rate = sum(s['rate'] for s in all_student_data) / total_students if total_students > 0 else 0

    # Categorize students
    excellent_count = sum(1 for s in all_student_data if s['rate'] >= 90)  # 90%+
    good_count = sum(1 for s in all_student_data if 75 <= s['rate'] < 90)  # 75-89%
    at_risk_count = sum(1 for s in all_student_data if 50 <= s['rate'] < 75)  # 50-74%
    chronic_absent_count = sum(1 for s in all_student_data if s['rate'] < 50)  # Below 50%

    overview = {
        'average_rate': round(avg_rate, 1),
        'total_students': total_students,
        'excellent_count': excellent_count,
        'good_count': good_count,
        'at_risk_count': at_risk_count,
        'chronic_absent_count': chronic_absent_count,
        'total_school_days': total_school_days,
        'days_recorded': len(daily_counts),
    }

    # Daily pattern (last 30 days)
    daily_pattern = []
    for date_key in sorted(daily_counts.keys())[-30:]:
        data = daily_counts[date_key]
        rate = (data['present'] / data['total'] * 100) if data['total'] > 0 else 0
        daily_pattern.append({
            'date': date_key,
            'rate': round(rate, 1),
            'present': data['present'],
            'total': data['total'],
        })

    # Weekly pattern
    day_order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    weekly_pattern = []
    for day in day_order:
        if day in weekly_counts:
            data = weekly_counts[day]
            rate = (data['present'] / data['total'] * 100) if data['total'] > 0 else 0
            weekly_pattern.append({
                'day': day[:3],  # Mon, Tue, etc.
                'rate': round(rate, 1),
            })

    # Chronic absentees (bottom 20 by rate)
    chronic_absentees = sorted(all_student_data, key=lambda x: x['rate'])[:20]

    # Top attendees (top 20 by rate)
    top_attendees = sorted(all_student_data, key=lambda x: x['rate'], reverse=True)[:20]

    # Attendance trend (by term - last 6 terms)
    attendance_trend = []
    all_sessions = (
        ClassSession.objects.filter(classroom__school=school)
        .values('academic_year', 'term')
        .distinct()
        .order_by('academic_year', 'term')
    )
    term_order = {'First Term': 1, 'Second Term': 2, 'Third Term': 3}
    sorted_sessions = sorted(
        all_sessions,
        key=lambda x: (x['academic_year'], term_order.get(x['term'], 0))
    )[-6:]

    for sess in sorted_sessions:
        sess_cs = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=sess['academic_year'],
            term=sess['term']
        )
        total_present = 0
        total_records = 0
        for cs in sess_cs:
            records = AttendanceRecord.objects.filter(class_session=cs)
            total_records += records.count()
            total_present += records.filter(is_present=True).count()

        if total_records > 0:
            rate = (total_present / total_records) * 100
            attendance_trend.append({
                'session': sess['academic_year'],
                'term': sess['term'],
                'label': f"{sess['term'][:1]}T {sess['academic_year'].split('/')[0][-2:]}",
                'rate': round(rate, 1),
            })

    # Comparison data
    comparison = None
    if compare_session and compare_term:
        comp_cs = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=compare_session,
            term=compare_term
        )
        comp_total_present = 0
        comp_total_records = 0
        comp_student_rates = []

        for cs in comp_cs:
            records = AttendanceRecord.objects.filter(class_session=cs)
            comp_total_records += records.count()
            comp_total_present += records.filter(is_present=True).count()

            student_ids = records.values_list('student_id', flat=True).distinct()
            for student_id in set(student_ids):
                student_records = records.filter(student_id=student_id)
                total_days = student_records.count()
                present_days = student_records.filter(is_present=True).count()
                if total_days > 0:
                    comp_student_rates.append((present_days / total_days) * 100)

        if comp_total_records > 0:
            comp_avg_rate = sum(comp_student_rates) / len(comp_student_rates) if comp_student_rates else 0
            comp_excellent = sum(1 for r in comp_student_rates if r >= 90)
            comp_good = sum(1 for r in comp_student_rates if 75 <= r < 90)
            comp_at_risk = sum(1 for r in comp_student_rates if 50 <= r < 75)
            comp_chronic = sum(1 for r in comp_student_rates if r < 50)
            comparison = {
                'session': compare_session,
                'term': compare_term,
                'average_rate': round(comp_avg_rate, 1),
                'total_students': len(comp_student_rates),
                'excellent_count': comp_excellent,
                'good_count': comp_good,
                'at_risk_count': comp_at_risk,
                'chronic_absent_count': comp_chronic,
            }

    return Response({
        'overview': overview,
        'attendance_by_class': class_attendance,
        'daily_pattern': daily_pattern,
        'weekly_pattern': weekly_pattern,
        'attendance_trend': attendance_trend,
        'chronic_absentees': chronic_absentees,
        'top_attendees': top_attendees,
        'comparison': comparison,
        'session': session,
        'term': term,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsProprietorRole])
def proprietor_staff_enrollment(request):
    """
    Comprehensive staff and enrollment analytics including:
    - Staff overview (teachers, principals, admins)
    - Teacher workload distribution
    - Subjects without teachers
    - Enrollment statistics
    - Students by class and department
    - Enrollment trends
    - Class capacity utilization
    """
    school = getattr(request, 'school', None)
    if not school:
        return Response({'error': 'School not found'}, status=status.HTTP_400_BAD_REQUEST)

    session = request.query_params.get('session', school.current_academic_year)
    term = request.query_params.get('term', school.current_term)
    compare_session = request.query_params.get('compare_session')
    compare_term = request.query_params.get('compare_term')

    # ==================== STAFF OVERVIEW ====================

    # Count staff by role
    teachers = CustomUser.objects.filter(school=school, role='teacher')
    active_teachers = teachers.filter(is_active=True).count()
    inactive_teachers = teachers.filter(is_active=False).count()

    principals = CustomUser.objects.filter(school=school, role='principal')
    active_principals = principals.filter(is_active=True).count()

    admins = CustomUser.objects.filter(school=school, role='admin')
    active_admins = admins.filter(is_active=True).count()

    # Staff gender distribution
    teacher_gender = {
        'male': teachers.filter(is_active=True, gender='Male').count(),
        'female': teachers.filter(is_active=True, gender='Female').count(),
    }

    staff_overview = {
        'total_teachers': active_teachers,
        'inactive_teachers': inactive_teachers,
        'total_principals': active_principals,
        'total_admins': active_admins,
        'total_staff': active_teachers + active_principals + active_admins,
        'teacher_gender': teacher_gender,
    }

    # Teacher workload
    class_sessions = ClassSession.objects.filter(
        classroom__school=school,
        academic_year=session,
        term=term
    )

    teacher_workload = []
    for teacher in teachers.filter(is_active=True):
        subjects = Subject.objects.filter(
            teacher=teacher,
            class_session__in=class_sessions
        ).select_related('class_session__classroom')

        if subjects.exists():
            classes_taught = set(s.class_session.classroom.name for s in subjects)
            student_count = StudentSession.objects.filter(
                class_session__in=subjects.values_list('class_session', flat=True),
                is_active=True
            ).values('student').distinct().count()

            teacher_workload.append({
                'teacher_id': teacher.id,
                'teacher_name': f"{teacher.first_name} {teacher.last_name}",
                'subjects_count': subjects.count(),
                'classes_count': len(classes_taught),
                'classes': list(classes_taught),
                'students_count': student_count,
            })

    teacher_workload.sort(key=lambda x: x['subjects_count'], reverse=True)

    # Teachers without subjects
    teachers_without_subjects = []
    for teacher in teachers.filter(is_active=True):
        has_subjects = Subject.objects.filter(
            teacher=teacher,
            class_session__in=class_sessions
        ).exists()
        if not has_subjects:
            teachers_without_subjects.append({
                'teacher_id': teacher.id,
                'teacher_name': f"{teacher.first_name} {teacher.last_name}",
            })

    # Subjects without teachers
    subjects_without_teachers = []
    all_subjects = Subject.objects.filter(class_session__in=class_sessions)
    for subject in all_subjects.filter(teacher__isnull=True):
        subjects_without_teachers.append({
            'subject_name': subject.name,
            'class_name': subject.class_session.classroom.name,
        })

    # ==================== ENROLLMENT (Term-Specific) ====================

    # Get students enrolled in this term's class sessions via StudentSession
    term_student_ids = StudentSession.objects.filter(
        class_session__in=class_sessions,
        is_active=True
    ).values_list('student_id', flat=True).distinct()

    # Get the actual student objects for these enrolled students
    term_students = CustomUser.objects.filter(id__in=term_student_ids, is_active=True)
    total_students = term_students.count()

    # Teacher-student ratio (using term-specific student count)
    teacher_student_ratio = round(total_students / active_teachers, 1) if active_teachers > 0 else 0

    # Gender distribution (term-specific)
    student_gender = {
        'male': term_students.filter(gender='Male').count(),
        'female': term_students.filter(gender='Female').count(),
        'unspecified': term_students.filter(Q(gender__isnull=True) | Q(gender='')).count(),
    }

    # Students by class (term-specific, from StudentSession)
    students_by_class = []
    for cs in class_sessions:
        count = StudentSession.objects.filter(
            class_session=cs,
            is_active=True
        ).count()
        if count > 0:
            students_by_class.append({
                'class_name': cs.classroom.name,
                'student_count': count,
                'has_departments': cs.classroom.has_departments,
            })

    students_by_class.sort(key=lambda x: x['student_count'], reverse=True)

    # Students by department (term-specific)
    students_by_department = []
    for dept in ['Science', 'Arts', 'Commercial']:
        count = term_students.filter(department=dept).count()
        if count > 0:
            students_by_department.append({
                'department': dept,
                'student_count': count,
            })

    # New enrollments this term (students enrolled this term who have no prior StudentSession records)
    # Get all class sessions BEFORE the current term
    term_order = {'First Term': 1, 'Second Term': 2, 'Third Term': 3}
    current_term_order = term_order.get(term, 0)

    prior_class_sessions = ClassSession.objects.filter(
        classroom__school=school
    ).exclude(
        academic_year=session, term=term
    ).filter(
        Q(academic_year__lt=session) |
        Q(academic_year=session, term__in=[t for t, o in term_order.items() if o < current_term_order])
    )

    # Students who had enrollment in prior terms
    students_with_prior_enrollment = StudentSession.objects.filter(
        class_session__in=prior_class_sessions,
        student_id__in=term_student_ids
    ).values_list('student_id', flat=True).distinct()

    # New enrollments = current term students minus those with prior enrollment
    new_enrollments = len(set(term_student_ids) - set(students_with_prior_enrollment))

    # Students without class assignment (active students in school but not in any class session this term)
    all_active_students = CustomUser.objects.filter(school=school, role='student', is_active=True)
    students_no_class = all_active_students.exclude(id__in=term_student_ids).count()

    enrollment_overview = {
        'total_students': total_students,
        'student_gender': student_gender,
        'new_enrollments': new_enrollments,
        'students_no_class': students_no_class,
    }

    # Enrollment trend (by term)
    enrollment_trend = []
    term_order = {'First Term': 1, 'Second Term': 2, 'Third Term': 3}
    all_sessions = (
        ClassSession.objects.filter(classroom__school=school)
        .values('academic_year', 'term')
        .distinct()
    )
    sorted_sessions = sorted(
        all_sessions,
        key=lambda x: (x['academic_year'], term_order.get(x['term'], 0))
    )[-6:]

    for sess in sorted_sessions:
        # Count students in sessions for that term
        sess_cs = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=sess['academic_year'],
            term=sess['term']
        )
        student_count = StudentSession.objects.filter(
            class_session__in=sess_cs,
            is_active=True
        ).values('student').distinct().count()

        if student_count > 0:
            enrollment_trend.append({
                'session': sess['academic_year'],
                'term': sess['term'],
                'label': f"{sess['term'][:1]}T {sess['academic_year'].split('/')[0][-2:]}",
                'count': student_count,
            })

    # Comparison data
    comparison = None
    if compare_session and compare_term:
        comp_cs = ClassSession.objects.filter(
            classroom__school=school,
            academic_year=compare_session,
            term=compare_term
        )

        # Get students enrolled in comparison term via StudentSession
        comp_student_ids = StudentSession.objects.filter(
            class_session__in=comp_cs,
            is_active=True
        ).values_list('student_id', flat=True).distinct()

        comp_term_students = CustomUser.objects.filter(id__in=comp_student_ids, is_active=True)
        comp_student_count = comp_term_students.count()

        # Teachers who taught in comparison term
        comp_teachers = Subject.objects.filter(
            class_session__in=comp_cs
        ).values('teacher').distinct().count()

        # Get comparison student gender distribution (term-specific)
        comp_student_gender = {
            'male': comp_term_students.filter(gender='Male').count(),
            'female': comp_term_students.filter(gender='Female').count(),
            'unspecified': comp_term_students.filter(Q(gender__isnull=True) | Q(gender='')).count(),
        }

        # Students without class in comparison period (active students not enrolled in that term)
        all_active_at_comparison = CustomUser.objects.filter(school=school, role='student', is_active=True)
        comp_students_no_class = all_active_at_comparison.exclude(id__in=comp_student_ids).count()

        # Teacher-student ratio for comparison
        comp_teacher_student_ratio = round(comp_student_count / comp_teachers, 1) if comp_teachers > 0 else 0

        # Count inactive teachers (same as current - staff count doesn't change by term)
        comp_inactive_teachers = inactive_teachers

        comparison = {
            'session': compare_session,
            'term': compare_term,
            'total_students': comp_student_count,
            'total_teachers': comp_teachers,
            'student_gender': comp_student_gender,
            'students_no_class': comp_students_no_class,
            'teacher_student_ratio': comp_teacher_student_ratio,
            'inactive_teachers': comp_inactive_teachers,
        }

    return Response({
        'staff_overview': staff_overview,
        'teacher_workload': teacher_workload[:20],
        'teachers_without_subjects': teachers_without_subjects,
        'subjects_without_teachers': subjects_without_teachers,
        'teacher_student_ratio': teacher_student_ratio,
        'enrollment_overview': enrollment_overview,
        'students_by_class': students_by_class,
        'students_by_department': students_by_department,
        'enrollment_trend': enrollment_trend,
        'comparison': comparison,
        'session': session,
        'term': term,
    })


