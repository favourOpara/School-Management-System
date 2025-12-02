"""
PDF Receipt Generator for School Fee Receipts
"""
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from datetime import datetime


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

    # Header - School Logo
    try:
        # Try to load the school logo
        import os
        from django.conf import settings

        # Try multiple possible logo locations
        logo_paths = [
            os.path.join(settings.BASE_DIR, '..', 'frontend', 'public', 'logo.png'),
            os.path.join(settings.BASE_DIR, 'static', 'logo.png'),
        ]

        logo_found = False
        for logo_path in logo_paths:
            if os.path.exists(logo_path):
                logo = Image(logo_path, width=2*inch, height=2*inch, kind='proportional')
                logo.hAlign = 'CENTER'
                elements.append(logo)
                elements.append(Spacer(1, 0.1*inch))
                logo_found = True
                break

        if not logo_found:
            raise Exception("Logo not found")
    except Exception as e:
        # If logo fails to load, show school name as fallback
        school_name = Paragraph("<b>SCHOOL MANAGEMENT SYSTEM</b>", title_style)
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
