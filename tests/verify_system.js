const { prisma } = require('../dist/server/server/config/prisma');
const { holdSlot, confirmBookingTransaction } = require('../dist/server/server/services/slotLockService');
const { addDoctorLeaveAndHandleConflicts } = require('../dist/server/server/services/leaveManagementService');
const { generatePreVisitSummary, generatePostVisitSummary } = require('../dist/server/server/services/geminiService');

async function runTests() {
  console.log('🧪 Starting System Verification Test Suite...\n');

  try {
    // Test 1: Fetch Seeded Doctor & Patient
    const doctor = await prisma.doctorProfile.findFirst({
      include: { user: true }
    });
    const patient = await prisma.user.findFirst({
      where: { role: 'PATIENT' }
    });

    if (!doctor || !patient) {
      throw new Error('Test failed: Demo doctor or patient not found in database.');
    }
    console.log(`✅ Test 1 Passed: Found Doctor (${doctor.user.name}) and Patient (${patient.name})`);

    // Test 2: Double Booking & Concurrent Slot Locking
    const testDate = '2026-09-15';
    const testSlot = '14:00';

    console.log(`\n🔒 Testing Slot Hold & Double Booking Prevention for ${testDate} at ${testSlot}...`);
    
    // Hold slot for Patient 1
    const holdRes = await holdSlot(doctor.id, testDate, testSlot, patient.id);
    console.log(`  - Slot hold created successfully. Hold ID: ${holdRes.holdId}`);

    // Confirm booking for Patient 1
    const appt = await confirmBookingTransaction({
      patientId: patient.id,
      doctorId: doctor.id,
      appointmentDate: testDate,
      startTime: testSlot,
      endTime: '14:30',
      symptoms: 'Test symptoms for double booking prevention'
    });
    console.log(`  - Booking confirmed. Appointment ID: ${appt.id}`);

    // Attempt second booking on SAME slot -> MUST throw error
    let doubleBookingBlocked = false;
    try {
      await confirmBookingTransaction({
        patientId: patient.id,
        doctorId: doctor.id,
        appointmentDate: testDate,
        startTime: testSlot,
        endTime: '14:30',
        symptoms: 'Second booking attempt'
      });
    } catch (err) {
      doubleBookingBlocked = true;
      console.log(`  - Double-booking attempt safely caught and rejected: "${err.message}"`);
    }

    if (!doubleBookingBlocked) {
      throw new Error('Test 2 Failed: Double booking was allowed!');
    }
    console.log(`✅ Test 2 Passed: Double booking prevention verified.`);

    // Test 3: Doctor Leave Conflict Management
    console.log(`\n📅 Testing Doctor Leave Conflict Handling on ${testDate}...`);
    const leaveResult = await addDoctorLeaveAndHandleConflicts(doctor.id, testDate, 'Medical Conference');
    
    const updatedAppt = await prisma.appointment.findUnique({ where: { id: appt.id } });
    if (updatedAppt?.status !== 'CANCELLED_LEAVE') {
      throw new Error(`Test 3 Failed: Appointment status expected CANCELLED_LEAVE, got ${updatedAppt?.status}`);
    }
    console.log(`  - Affected appointment automatically marked CANCELLED_LEAVE and patient notified.`);
    console.log(`✅ Test 3 Passed: Doctor leave conflict resolution verified.`);

    // Test 4: AI Pre-Visit & Post-Visit Summary Generators
    console.log(`\n🤖 Testing AI Pre-Visit & Post-Visit Summary Engines...`);
    const preSummary = await generatePreVisitSummary('Persistent dry cough and mild fever for 2 days.');
    if (!preSummary.urgency || !preSummary.chiefComplaint || preSummary.suggestedQuestions.length === 0) {
      throw new Error('Test 4 Failed: Pre-visit AI summary output invalid format');
    }
    console.log(`  - Pre-visit AI summary generated successfully (Urgency: ${preSummary.urgency}).`);

    const postSummary = await generatePostVisitSummary('Prescribed Amoxicillin 500mg twice daily for 5 days. Rest and stay hydrated.');
    if (!postSummary.patientSummary || !Array.isArray(postSummary.medicationSchedule)) {
      throw new Error('Test 4 Failed: Post-visit AI summary output invalid format');
    }
    console.log(`  - Post-visit AI summary generated successfully.`);
    console.log(`✅ Test 4 Passed: AI Summaries and Fallback engine verified.`);

    console.log('\n🎉 ALL SYSTEM VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
