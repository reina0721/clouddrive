from reportlab.pdfgen import canvas
from reportlab.lib.pdfencrypt import StandardEncryption
from pathlib import Path
out=Path(__file__).resolve().parent;out.mkdir(exist_ok=True)
def create(name,password=None,pages=10):
 c=canvas.Canvas(str(out/name),pagesize=(612,792),pageCompression=1,encrypt=StandardEncryption(password,canPrint=1,canModify=1,canCopy=1,canAnnotate=1) if password else None)
 c.setTitle('CloudDrive PDF acceptance')
 for page in range(1,pages+1):
  c.bookmarkPage('page'+str(page));c.addOutlineEntry('Chapter '+str(page),'page'+str(page),0,False)
  c.setFillColorRGB(.14,.22,.39);c.setFont('Helvetica-Bold',24);c.drawString(48,730,'CloudDrive PDF workspace')
  c.setFillColorRGB(.2,.2,.2);c.setFont('Helvetica',14)
  c.drawString(48,692,'Page '+str(page)+' of '+str(pages))
  c.drawString(48,660,'Alpha alpha ALPHA alphabet')
  c.drawString(48,632,'Select this sentence to copy real PDF text.')
  c.drawString(48,604,'Acceptance feature '+str(page)+': bounded local reading.')
  c.setStrokeColorRGB(.2,.5,.8);c.roundRect(48,430,510,120,12,stroke=1,fill=0)
  c.setFont('Helvetica',12);c.drawString(64,520,'Real vector graphics. Add text, highlight, and ink here.')
  c.setFillColorRGB(.1,.3,.8);c.drawString(48,390,'Go to last chapter');c.linkAbsolute('Last chapter','page'+str(pages),(48,380,200,405))
  c.drawString(48,350,'Return to first chapter');c.linkAbsolute('First chapter','page1',(48,340,220,365))
  c.setFont('Helvetica',10);c.setFillColorRGB(.4,.4,.4);c.drawString(48,48,'Project-owned test content. No user file or external content.')
  c.showPage()
 c.save()
create('reader.pdf');create('encrypted.pdf','reader-test-password');create('over-pages.pdf',pages=501)


# 真实可解码但超过默认8Mi像素的压缩图像，区分源字节与解码预算。
from PIL import Image
from reportlab.lib.utils import ImageReader
c=canvas.Canvas(str(out/'over-image.pdf'),pagesize=(612,792),pageCompression=1)
c.drawImage(ImageReader(Image.new('RGB',(3000,3000),'red')),48,48,width=516,height=696)
c.showPage();c.save()

c=canvas.Canvas(str(out/'under-image.pdf'),pagesize=(612,792),pageCompression=1)
c.drawImage(ImageReader(Image.new('RGB',(2000,2000),'red')),48,48,width=516,height=696)
c.showPage();c.save()
print('Created 5 project-owned PDF fixtures')
