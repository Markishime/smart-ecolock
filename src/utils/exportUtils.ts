import html2canvas from 'html2canvas';
import jspdf from 'jspdf';

export const exportToCSV = (data: any[], filename: string) => {
  const csvContent = [
    Object.keys(data[0]).join(','),
    ...data.map(item => Object.values(item).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  html2canvas(element).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  });
};
