"""
PDF Generator for School Fee Receipts and Report Sheets
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak, KeepTogether
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfgen import canvas
from io import BytesIO
from datetime import datetime
import os


def generate_fee_receipt_pdf(receipt, payment_history):
    """
    Generate a professional PDF receipt with payment history

    Args:
        receipt: FeeReceipt object
        payment_history: List of FeePaymentHistory objects

    Returns:
        BytesIO: PDF file as bytes
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=0.75*inch, leftMargin=0.75*inch,
                           topMargin=0.75*inch, bottomMargin=0.75*inch)

    # Container for the 'Flowable' objects
    elements = []

    # Define styles
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1976d2'),
        spaceAfter=6,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )

    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=12,
        textColor=colors.HexColor('#666666'),
        spaceAfter=20,
        alignment=TA_CENTER
    )

    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=colors.HexColor('#1976d2'),
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold'
    )

    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=6
    )

    # Header - School Logo (Centered at top)
    try:
        # Try to load the school logo
        import os
        from django.conf import settings

        # Try multiple possible logo locations
        logo_paths = [
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png'),
            os.path.join(settings.BASE_DIR, 'static', 'logo.png'),
            '/Users/newuser/Downloads/School-Management-System/frontend/public/logo.png',
        ]

        logo_found = False
        for logo_path in logo_paths:
            if os.path.exists(logo_path):
                logo = Image(logo_path, width=1.5*inch, height=1.5*inch, kind='proportional')
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.15*inch))
                logo_found = True
                break

        if not logo_found:
            # Fallback - just add space
            elements.append(Spacer(1, 0.3*inch))
    except Exception as e:
        # If logo fails to load, just add space
        elements.append(Spacer(1, 0.3*inch))

    # School Name (Centered)
    school_name = Paragraph("<b>FIGIL HIGH SCHOOL</b>", title_style)
    elements.append(school_name)

    school_info = Paragraph("Official Fee Receipt", subtitle_style)
    elements.append(school_info)

    # Add a line separator
    elements.append(Spacer(1, 0.2*inch))

    # Receipt Header Information
    receipt_info_data = [
        ['Receipt Number:', receipt.receipt_number, 'Date Issued:', receipt.date_issued.strftime("%d %b, %Y")],
        ['Academic Year:', receipt.academic_year, 'Term:', receipt.term],
    ]

    receipt_info_table = Table(receipt_info_data, colWidths=[1.5*inch, 2*inch, 1.5*inch, 2*inch])
    receipt_info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#666666')),
        ('TEXTCOLOR', (2, 0), (2, -1), colors.HexColor('#666666')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    elements.append(receipt_info_table)
    elements.append(Spacer(1, 0.3*inch))

    # Student Information
    student_heading = Paragraph("Student Information", heading_style)
    elements.append(student_heading)

    student_data = [
        ['Student Name:', f"{receipt.student.first_name} {receipt.student.last_name}"],
        ['Username:', receipt.student.username],
        ['Class:', receipt.student.classroom.name if receipt.student.classroom else 'N/A'],
    ]

    student_table = Table(student_data, colWidths=[2*inch, 4.5*inch])
    student_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TEXTCOLOR', (0, 0), (0, -1), colors.HexColor('#333333')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(student_table)
    elements.append(Spacer(1, 0.3*inch))

    # Fee Summary
    fee_heading = Paragraph("Fee Summary", heading_style)
    elements.append(fee_heading)

    fee_data = [
        ['Description', 'Amount'],
        ['Total School Fees', f'₦{receipt.total_fees:,.2f}'],
        ['Amount Paid', f'₦{receipt.amount_paid:,.2f}'],
        ['Outstanding Balance', f'₦{receipt.balance:,.2f}'],
    ]

    fee_table = Table(fee_data, colWidths=[4*inch, 2.5*inch])
    fee_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTSIZE', (0, 1), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('TOPPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -2), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#e0e0e0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
        # Highlight balance row
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f8f9fa')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('TEXTCOLOR', (1, -1), (1, -1), colors.HexColor('#d32f2f') if receipt.balance > 0 else colors.HexColor('#2e7d32')),
    ]))
    elements.append(fee_table)
    elements.append(Spacer(1, 0.3*inch))

    # Payment Status Badge
    status_color = '#2e7d32' if receipt.status == 'paid' else ('#f57c00' if receipt.status == 'partial' else '#c2185b')
    status_text = receipt.status.upper()
    status_para = Paragraph(f'<para align="center" backColor="{status_color}" textColor="white" fontSize="12" fontName="Helvetica-Bold" leftIndent="10" rightIndent="10" spaceAfter="5" spaceBefore="5">{status_text}</para>', normal_style)
    elements.append(status_para)
    elements.append(Spacer(1, 0.3*inch))

    # Payment History
    if payment_history and len(payment_history) > 0:
        history_heading = Paragraph("Payment History", heading_style)
        elements.append(history_heading)

        history_data = [['Date', 'Type', 'Amount', 'Balance Before', 'Balance After', 'Recorded By']]

        for transaction in payment_history:
            history_data.append([
                transaction.transaction_date.strftime("%d/%m/%Y %H:%M"),
                transaction.transaction_type.title(),
                f'₦{transaction.amount:,.2f}',
                f'₦{transaction.balance_before:,.2f}',
                f'₦{transaction.balance_after:,.2f}',
                f"{transaction.recorded_by.first_name} {transaction.recorded_by.last_name}" if transaction.recorded_by else 'System'
            ])

        history_table = Table(history_data, colWidths=[1.3*inch, 0.9*inch, 1*inch, 1.1*inch, 1.1*inch, 1.1*inch])
        history_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1976d2')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (2, 0), (4, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')]),
        ]))
        elements.append(history_table)
        elements.append(Spacer(1, 0.3*inch))

    # Remarks (if any)
    if receipt.remarks:
        remarks_heading = Paragraph("Remarks", heading_style)
        elements.append(remarks_heading)
        remarks_para = Paragraph(receipt.remarks, normal_style)
        elements.append(remarks_para)
        elements.append(Spacer(1, 0.3*inch))

    # Footer
    elements.append(Spacer(1, 0.5*inch))

    # Issued by information
    issued_by_text = f"Issued by: <b>{receipt.issued_by.first_name} {receipt.issued_by.last_name}</b>" if receipt.issued_by else "Issued by: <b>System</b>"
    issued_by = Paragraph(issued_by_text, normal_style)
    elements.append(issued_by)

    # Timestamp
    generated_time = datetime.now().strftime("%d %b, %Y at %H:%M:%S")
    timestamp = Paragraph(f"<i>Generated on: {generated_time}</i>",
                         ParagraphStyle('Timestamp', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#999999')))
    elements.append(timestamp)

    # Footer message
    elements.append(Spacer(1, 0.2*inch))
    footer_msg = Paragraph("<i>This is an official receipt. Please keep for your records.</i>",
                          ParagraphStyle('Footer', parent=styles['Normal'], fontSize=9,
                                       textColor=colors.HexColor('#666666'), alignment=TA_CENTER))
    elements.append(footer_msg)

    # Build PDF
    doc.build(elements)

    # Get the value of the BytesIO buffer and return it
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def generate_report_sheet_pdf(context):
    """
    Generate a professional report sheet PDF matching the exact HTML design

    Args:
        context: Dictionary with student, session, subjects, summary data

    Returns:
        BytesIO: PDF file as bytes
    """
    buffer = BytesIO()

    # Create doc with custom page size and margins to match HTML (0.3in margins)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=0.3*inch,
        leftMargin=0.3*inch,
        topMargin=0.3*inch,
        bottomMargin=0.3*inch
    )

    elements = []
    styles = getSampleStyleSheet()

    # Define custom colors to match HTML
    PURPLE = colors.HexColor('#7b1fa2')
    GOLD_BORDER = colors.HexColor('#d4af37')
    BLUE = colors.HexColor('#1976d2')
    DARK_GRAY = colors.HexColor('#333333')
    GRAY = colors.HexColor('#666666')
    LIGHT_GRAY = colors.HexColor('#f5f5f5')
    GREEN_BG = colors.HexColor('#c8e6c9')
    GREEN = colors.HexColor('#2e7d32')

    # Custom styles matching HTML
    school_name_style = ParagraphStyle(
        'SchoolName',
        parent=styles['Heading1'],
        fontSize=20,
        textColor=PURPLE,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        spaceAfter=2
    )

    report_title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Normal'],
        fontSize=11,
        textColor=DARK_GRAY,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold',
        spaceAfter=2
    )

    term_style = ParagraphStyle(
        'Term',
        parent=styles['Normal'],
        fontSize=9,
        textColor=GRAY,
        alignment=TA_CENTER,
        spaceAfter=12
    )

    detail_style = ParagraphStyle(
        'Detail',
        parent=styles['Normal'],
        fontSize=10,
        spaceAfter=2
    )

    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=GRAY,
        alignment=TA_CENTER
    )

    # === HEADER SECTION ===

    # School Logo
    logo_url = context.get('logo_url')
    if logo_url:
        try:
            from django.conf import settings
            # Try to load logo from file system
            logo_paths = [
                os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png'),
                os.path.join(settings.BASE_DIR, 'static', 'logo.png'),
            ]

            for logo_path in logo_paths:
                if os.path.exists(logo_path):
                    logo = Image(logo_path, width=0.8*inch, height=0.8*inch, kind='proportional')
                    logo.hAlign = 'CENTER'
                    elements.append(logo)
                    elements.append(Spacer(1, 0.05*inch))
                    break
        except:
            pass

    # School Name
    elements.append(Paragraph("Figil High School", school_name_style))

    # Report Title
    elements.append(Paragraph("Student Result Management System", report_title_style))

    # Term Information
    term_text = context.get('term_text', 'ONE')
    academic_year = context['session']['academic_year']
    term_para = Paragraph(
        f"Term {term_text} ({academic_year} Academic Session Report)",
        term_style
    )
    elements.append(term_para)

    elements.append(Spacer(1, 0.1*inch))

    # === STUDENT INFO SECTION WITH PHOTO ===

    student = context['student']
    photo_url = student.get('photo_url')

    # Create student details table and photo side by side
    student_info_data = []

    # Row 1: Student ID and Name
    student_info_data.append([
        Paragraph('<b>Student ID:</b>', detail_style),
        Paragraph(student['student_id'], detail_style),
        Paragraph('<b>Student Name:</b>', detail_style),
        Paragraph(student['name'], detail_style),
    ])

    # Row 2: Class and Department
    department = student.get('department', '')
    student_info_data.append([
        Paragraph('<b>Class:</b>', detail_style),
        Paragraph(student['class'], detail_style),
        Paragraph('<b>Department:</b>', detail_style),
        Paragraph(department if department else '', detail_style),
    ])

    student_info_table = Table(student_info_data, colWidths=[1*inch, 1.8*inch, 1.3*inch, 1.8*inch])
    student_info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
    ]))

    # Create a table to hold student info and photo side by side
    if photo_url:
        try:
            # Handle base64 encoded image
            if photo_url.startswith('data:image'):
                import base64
                from reportlab.lib.utils import ImageReader

                # Extract base64 data
                photo_data = photo_url.split(',')[1]
                img_data = base64.b64decode(photo_data)
                img_buffer = BytesIO(img_data)

                # Create image
                photo_img = Image(img_buffer, width=0.9*inch, height=1.1*inch, kind='proportional')
                photo_img.hAlign = 'RIGHT'

                # Create combined table with info and photo
                combined_data = [[student_info_table, photo_img]]
                combined_table = Table(combined_data, colWidths=[6*inch, 1*inch])
                combined_table.setStyle(TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
                ]))
                elements.append(combined_table)
            else:
                elements.append(student_info_table)
        except:
            elements.append(student_info_table)
    else:
        elements.append(student_info_table)

    elements.append(Spacer(1, 0.15*inch))

    # === GRADES TABLE ===

    grading_config = context['grading_config']
    subjects = context['subjects']

    # Table headers
    grades_data = [[
        'Subjects',
        f"1st Test\n({grading_config['first_test_max']}marks)",
        f"2nd Test\n({grading_config['second_test_max']}marks)",
        f"Exam\n({grading_config['exam_max']}marks)",
        f"Total\n({grading_config['total_max']}marks)",
        'Grades'
    ]]

    # Subject rows
    for subject in subjects:
        grades_data.append([
            subject['subject_name'],
            str(subject['first_test_score']),
            str(subject['second_test_score']),
            str(subject['exam_score']),
            str(subject['total_score']),
            subject['letter_grade']
        ])

    # Summary rows
    summary = context['summary']

    # Grand Total row
    grades_data.append([
        'Grand Total',
        '',
        '',
        '',
        str(summary['grand_total']),
        ''
    ])

    # Average row
    grades_data.append([
        'Average',
        '',
        '',
        '',
        str(summary['average']),
        ''
    ])

    # Position row
    position_text = f"{summary['position']} of {summary['total_students']}" if summary.get('position') else '-'
    grades_data.append([
        'Position',
        '',
        '',
        '',
        position_text,
        ''
    ])

    # Calculate column widths
    grades_table = Table(grades_data, colWidths=[2.4*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.7*inch])

    # Number of subject rows (excluding header and 3 summary rows)
    num_subjects = len(subjects)

    # Apply table styles
    table_styles = [
        # Header row styles (purple background, white text)
        ('BACKGROUND', (0, 0), (-1, 0), PURPLE),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (1, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 0), (0, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),

        # Subject rows styles
        ('FONTSIZE', (0, 1), (-1, num_subjects), 9),
        ('ALIGN', (1, 1), (-1, num_subjects), 'CENTER'),
        ('ALIGN', (0, 1), (0, num_subjects), 'LEFT'),
        ('FONTNAME', (0, 1), (0, num_subjects), 'Helvetica-Bold'),
        ('TEXTCOLOR', (4, 1), (4, num_subjects), BLUE),  # Total column in blue
        ('FONTNAME', (4, 1), (4, num_subjects), 'Helvetica-Bold'),
        ('TEXTCOLOR', (5, 1), (5, num_subjects), PURPLE),  # Grade column in purple
        ('FONTNAME', (5, 1), (5, num_subjects), 'Helvetica-Bold'),

        # Summary rows (Grand Total, Average, Position)
        ('BACKGROUND', (0, num_subjects + 1), (-1, num_subjects + 3), LIGHT_GRAY),
        ('FONTNAME', (0, num_subjects + 1), (0, num_subjects + 3), 'Helvetica-Bold'),
        ('FONTNAME', (4, num_subjects + 1), (4, num_subjects + 3), 'Helvetica-Bold'),
        ('TEXTCOLOR', (4, num_subjects + 1), (4, num_subjects + 3), BLUE),
        ('FONTSIZE', (0, num_subjects + 1), (-1, num_subjects + 3), 10),

        # Position row special styling (green background)
        ('BACKGROUND', (0, num_subjects + 3), (-1, num_subjects + 3), GREEN_BG),
        ('TEXTCOLOR', (4, num_subjects + 3), (4, num_subjects + 3), GREEN),

        # General table styles
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]

    grades_table.setStyle(TableStyle(table_styles))
    elements.append(grades_table)

    # === FOOTER ===
    elements.append(Spacer(1, 0.15*inch))

    # Add border line
    from reportlab.platypus import HRFlowable
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e0e0e0'), spaceAfter=8))

    # Generated date
    generated_date = context.get('generated_date', datetime.now().strftime('%m/%d/%Y, %H:%M:%S'))
    elements.append(Paragraph(f"Generated on {generated_date}", footer_style))

    # Build PDF
    doc.build(elements)

    # Get the value of the BytesIO buffer
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
