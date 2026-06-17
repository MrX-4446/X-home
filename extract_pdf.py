import pdfplumber

pdf = pdfplumber.open(r'D:\X\记忆参考资料1.pdf')
pages_text = []
for i, page in enumerate(pdf.pages):
    text = page.extract_text()
    if text:
        pages_text.append(f"--- Page {i+1} ---\n\n{text}")

full_text = '\n\n'.join(pages_text)

with open(r'D:\X\记忆参考资料1.txt', 'w', encoding='utf-8') as f:
    f.write(full_text)

print(f"Successfully extracted {len(pdf.pages)} pages")
print(f"Total characters: {len(full_text)}")
