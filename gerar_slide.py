import qrcode
from fpdf import FPDF
import os

# Generate QR Code image
url = "https://aplicativo-geo-capital-engine-v2-xrktsm3cdrcyyhm989e64c.streamlit.app"
img_path = "qrcode_mvp.png"
qr = qrcode.QRCode(box_size=10, border=4)
qr.add_data(url)
qr.make(fit=True)
img = qr.make_image(fill_color="black", back_color="white")
img.save(img_path)

# Create PDF
pdf = FPDF(orientation='L', unit='mm', format='A4') # Landscape
pdf.add_page()
pdf.set_fill_color(30, 40, 80) # Dark blue background
pdf.rect(0, 0, 297, 210, 'F')

pdf.set_text_color(255, 255, 255)
pdf.set_font("Arial", 'B', 24)
pdf.cell(0, 20, "ROADMAP E ACESSO", ln=True, align='L')
pdf.set_font("Arial", 'B', 32)
pdf.cell(0, 20, "Da demonstracao ao produto", ln=True, align='L')

pdf.ln(20)

# Links on the left
pdf.set_font("Arial", 'B', 14)
pdf.cell(0, 10, "EQUIPE E PARTICIPANTES (Grupo 12):", ln=True)
pdf.set_font("Arial", '', 14)
pdf.cell(0, 8, "- Leonardo Junior Gonzales Mendoza", ln=True)
pdf.cell(0, 8, "- Helton Abadia", ln=True)
pdf.cell(0, 8, "- Felipe Vieira", ln=True)

pdf.ln(15)
pdf.set_font("Arial", 'B', 14)
pdf.cell(0, 10, "VIDEO DO PITCH (YOUTUBE):", ln=True)
pdf.set_font("Arial", '', 12)
pdf.cell(0, 8, "https://youtu.be/fl7tKUQyPh4", ln=True)

pdf.ln(10)
pdf.set_font("Arial", 'B', 14)
pdf.cell(0, 10, "REPOSITORIO (GITHUB):", ln=True)
pdf.set_font("Arial", '', 12)
pdf.cell(0, 8, "https://github.com/LeonardoGMendoza/aplicativo-geo-capital-engine-v2", ln=True)

pdf.ln(10)
pdf.set_font("Arial", 'B', 14)
pdf.cell(0, 10, "MVP PUBLICO:", ln=True)
pdf.set_font("Arial", '', 12)
pdf.cell(0, 8, url, ln=True)

# Add QR code image on the right
pdf.image(img_path, x=180, y=60, w=80)
pdf.set_xy(180, 145)
pdf.set_font("Arial", 'B', 16)
pdf.cell(80, 10, "ESCANEIE PARA TESTAR", align='C', ln=True)

# Output PDF
pdf_path = "Slide_Final_Grupo12.pdf"
pdf.output(pdf_path)
