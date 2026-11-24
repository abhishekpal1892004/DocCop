import PDFDocument from 'pdfkit';

export const generatePrescriptionPdfBuffer = ({ prescription, doctor, patient, clinic, appointment }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).font('Helvetica-Bold').text('MediBook Digital Prescription', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Prescription No: ${prescription.prescriptionNumber ?? 'DRAFT'}`);
    doc.text(`Status: ${prescription.status}   |   Version: ${prescription.version ?? 1}`);
    if (prescription.issuedAt) {
      doc.text(`Issued At: ${new Date(prescription.issuedAt).toISOString()}`);
    }
    doc.moveDown(0.8);

    // Doctor & Clinic
    doc.fontSize(12).font('Helvetica-Bold').text('Prescribing Practitioner');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Dr. ${prescription.doctorAttestation?.doctorName ?? doctor?.personalDetails?.fullName ?? 'Doctor'}`);
    doc.text(`Qualification: ${prescription.doctorAttestation?.qualification ?? doctor?.professionalDetails?.qualification ?? 'N/A'}`);
    doc.text(`Medical Registration Ref: ${prescription.doctorAttestation?.registrationNumberReference ?? doctor?.medicalRegistration?.registrationNumber ?? 'N/A'}`);
    if (clinic?.clinicName || doctor?.clinicDetails?.clinicName) {
      doc.text(`Clinic: ${clinic?.clinicName ?? doctor?.clinicDetails?.clinicName}`);
    }
    doc.moveDown(0.8);

    // Patient & Appointment
    doc.fontSize(12).font('Helvetica-Bold').text('Patient Information');
    doc.fontSize(10).font('Helvetica');
    doc.text(`Patient: ${patient?.fullName ?? patient?.email ?? 'Patient'}`);
    if (appointment?.startAt) {
      doc.text(`Appointment Date: ${new Date(appointment.startAt).toISOString()}`);
    }
    doc.moveDown(0.8);

    // Diagnosis & Clinical Notes
    if (prescription.diagnosis) {
      doc.fontSize(12).font('Helvetica-Bold').text('Diagnosis');
      doc.fontSize(10).font('Helvetica').text(prescription.diagnosis);
      doc.moveDown(0.5);
    }
    if (prescription.clinicalNotes) {
      doc.fontSize(12).font('Helvetica-Bold').text('Clinical Notes');
      doc.fontSize(10).font('Helvetica').text(prescription.clinicalNotes);
      doc.moveDown(0.5);
    }

    // Medicines
    doc.fontSize(12).font('Helvetica-Bold').text('Prescribed Medicines');
    doc.moveDown(0.3);
    (prescription.medicines ?? []).forEach((med, idx) => {
      doc.fontSize(10).font('Helvetica-Bold').text(
        `${idx + 1}. ${med.medicineName}${med.strength ? ` (${med.strength})` : ''}${med.dosageForm ? ` - ${med.dosageForm}` : ''}`
      );
      doc.font('Helvetica').text(
        `   Dose: ${med.dose} | Frequency: ${med.frequency} | Duration: ${med.duration}${med.route ? ` | Route: ${med.route}` : ''}`
      );
      if (med.instructions) {
        doc.text(`   Instructions: ${med.instructions}`);
      }
      doc.moveDown(0.3);
    });

    if (prescription.generalInstructions) {
      doc.moveDown(0.4);
      doc.fontSize(12).font('Helvetica-Bold').text('General Instructions');
      doc.fontSize(10).font('Helvetica').text(prescription.generalInstructions);
    }

    doc.moveDown(1.2);
    doc.fontSize(9).font('Helvetica-Oblique').text(
      'Attested electronically by the issuing practitioner via MediBook. This document is not a qualified cryptographic signature.'
    );

    doc.end();
  });
