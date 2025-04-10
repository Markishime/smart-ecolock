import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  deleteDoc,
  arrayUnion,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { ref, update } from 'firebase/database';
import { db, rtdb } from '../firebase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserGroupIcon, PlusIcon, TrashIcon, CalendarIcon, PencilIcon } from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';
import AdminSidebar from '../components/AdminSidebar';
import AddSectionModal from '../components/AddSectionModal';
import AssignStudentsModal from '../components/AssignStudentsModal';

interface Schedule {
  day: string;
  startTime: string;
  endTime: string;
  roomName: string;
}

interface Room {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  code: string;
  students: string[];
  instructorRfidUid: string;
  instructorId: string;
  subjectId: string;
  schedules: Schedule[];
  createdAt: string;
}

interface Instructor {
  id: string;
  fullName: string;
  rfidUid: string;
  assignedRooms?: string[];
}

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  rfidUid?: string;
  sectionId?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  sections: {
    id: string;
    name: string;
    code: string;
    instructorId: string;
    instructorName: string;
    instructorRfidUid: string;
    schedules: Schedule[];
    capacity: number;
    currentEnrollment: number;
  }[];
  department?: string;
  details?: string;
  credits?: number;
  prerequisites?: string[];
  learningObjectives?: string[];
  status?: 'active' | 'inactive';
}

// Type for adding a section (id is optional)
interface AddSectionData {
  name: string;
  code: string;
  instructorRfidUid: string;
  instructorId: string;
  subjectId: string;
  schedules: Schedule[];
}

// Type for editing a section (id is required)
interface EditSectionData {
  id: string;
  name: string;
  code: string;
  instructorRfidUid: string;
  instructorId: string;
  subjectId: string;
  schedules: Schedule[];
}

const AdminSectionPage = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);

  useEffect(() => {
    const unsubscribeFromSections = onSnapshot(
      collection(db, 'sections'),
      (snapshot) => {
        const sectionsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          schedules: doc.data().schedules || [],
          students: doc.data().students || [],
        })) as Section[];
        setSections(sectionsData);
      },
      (error) => console.error('Error fetching sections:', error)
    );

    const unsubscribeFromInstructors = onSnapshot(
      collection(db, 'teachers'),
      (snapshot) => {
        const instructorsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          fullName: doc.data().fullName || 'Unknown',
          rfidUid: doc.data().rfidUid || '',
          assignedRooms: doc.data().assignedRooms || [],
        })) as Instructor[];
        setInstructors(instructorsData);
      },
      (error) => console.error('Error fetching instructors:', error)
    );

    const unsubscribeFromStudents = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const studentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          fullName: doc.data().fullName || 'Unknown',
          idNumber: doc.data().idNumber || '',
          rfidUid: doc.data().rfidUid || '',
          sectionId: doc.data().sectionId || '',
        })) as Student[];
        setStudents(studentsData);
      },
      (error) => console.error('Error fetching students:', error)
    );

    const unsubscribeFromSubjects = onSnapshot(
      collection(db, 'subjects'),
      (snapshot) => {
        const subjectsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || 'Unknown',
          code: doc.data().code || '',
          sections: doc.data().sections || [],
          department: doc.data().department || 'Unknown',
          details: doc.data().details || '',
          credits: doc.data().credits || 0,
          prerequisites: doc.data().prerequisites || [],
          learningObjectives: doc.data().learningObjectives || [],
          status: doc.data().status || 'active',
        })) as Subject[];
        setSubjects(subjectsData);
      },
      (error) => console.error('Error fetching subjects:', error)
    );

    const unsubscribeFromRooms = onSnapshot(
      collection(db, 'rooms'),
      (snapshot) => {
        const roomsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || 'Unnamed Room',
        })) as Room[];
        setRooms(roomsData);
        setIsLoading(false);
      },
      (error) => console.error('Error fetching rooms:', error)
    );

    return () => {
      unsubscribeFromSections();
      unsubscribeFromInstructors();
      unsubscribeFromStudents();
      unsubscribeFromSubjects();
      unsubscribeFromRooms();
    };
  }, []);

  const handleAddSection = async (sectionData: AddSectionData) => {
    try {
      const newSectionRef = await addDoc(collection(db, 'sections'), {
        name: sectionData.name,
        code: sectionData.code,
        students: [],
        instructorRfidUid: sectionData.instructorRfidUid,
        instructorId: sectionData.instructorId,
        subjectId: sectionData.subjectId,
        schedules: sectionData.schedules,
        createdAt: new Date().toISOString(),
      });

      const instructor = instructors.find((i) => i.id === sectionData.instructorId);
      const newSectionDetails = {
        id: newSectionRef.id,
        name: sectionData.name,
        code: sectionData.code,
        instructorId: sectionData.instructorId,
        instructorName: instructor?.fullName || 'Unknown',
        instructorRfidUid: sectionData.instructorRfidUid,
        schedules: sectionData.schedules,
        capacity: 40,
        currentEnrollment: 0,
      };

      const subjectRef = doc(db, 'subjects', sectionData.subjectId);
      const subjectSnapshot = await getDocs(
        query(collection(db, 'subjects'), where('__name__', '==', sectionData.subjectId))
      );
      if (!subjectSnapshot.empty) {
        const subjectDoc = subjectSnapshot.docs[0];
        const existingSections = subjectDoc.data().sections || [];
        await updateDoc(subjectRef, {
          sections: [...existingSections, newSectionDetails],
        });
      } else {
        const subject = subjects.find((s) => s.id === sectionData.subjectId);
        if (!subject) throw new Error('Subject not found');
        await updateDoc(subjectRef, {
          name: subject.name,
          code: subject.code,
          department: subject.department,
          details: subject.details,
          credits: subject.credits,
          prerequisites: subject.prerequisites,
          learningObjectives: subject.learningObjectives,
          status: subject.status,
          sections: [newSectionDetails],
        });
      }

      const teacherRef = doc(db, 'teachers', sectionData.instructorId);
      const teacherDocSnapshot = await getDocs(
        query(collection(db, 'teachers'), where('__name__', '==', sectionData.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const existingAssignedSubjects = (existingData.assignedSubjects || []) as Subject[];

        const updatedAssignedSubjects = existingAssignedSubjects.filter(
          (sub) => sub.id !== sectionData.subjectId
        );
        updatedAssignedSubjects.push({
          id: sectionData.subjectId,
          name: subjects.find((s) => s.id === sectionData.subjectId)?.name || 'Unknown',
          code: subjects.find((s) => s.id === sectionData.subjectId)?.code || '',
          sections: [
            ...(existingAssignedSubjects.find((s) => s.id === sectionData.subjectId)?.sections || []),
            newSectionDetails,
          ],
        });

        await updateDoc(teacherRef, {
          assignedRooms: arrayUnion(
            ...sectionData.schedules.map((s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName)
          ),
          assignedSubjects: updatedAssignedSubjects,
        });
      }

      setIsModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Section Added Successfully',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error adding section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to add section. Please try again.',
      });
    }
  };

  const handleEditSection = async (sectionData: EditSectionData) => {
    try {
      const sectionRef = doc(db, 'sections', sectionData.id);
      await updateDoc(sectionRef, {
        name: sectionData.name,
        code: sectionData.code,
        instructorRfidUid: sectionData.instructorRfidUid,
        instructorId: sectionData.instructorId,
        subjectId: sectionData.subjectId,
        schedules: sectionData.schedules,
      });

      const instructor = instructors.find((i) => i.id === sectionData.instructorId);
      const updatedSectionDetails = {
        id: sectionData.id,
        name: sectionData.name,
        code: sectionData.code,
        instructorId: sectionData.instructorId,
        instructorName: instructor?.fullName || 'Unknown',
        instructorRfidUid: sectionData.instructorRfidUid,
        schedules: sectionData.schedules,
        capacity: 40,
        currentEnrollment: sections.find((s) => s.id === sectionData.id)?.students.length || 0,
      };

      const subjectRef = doc(db, 'subjects', sectionData.subjectId);
      const subjectSnapshot = await getDocs(
        query(collection(db, 'subjects'), where('__name__', '==', sectionData.subjectId))
      );
      if (!subjectSnapshot.empty) {
        const subjectDoc = subjectSnapshot.docs[0];
        const existingSections = subjectDoc.data().sections || [];
        const updatedSections = existingSections.map((sec: any) =>
          sec.id === sectionData.id ? updatedSectionDetails : sec
        );
        await updateDoc(subjectRef, { sections: updatedSections });
      }

      const teacherRef = doc(db, 'teachers', sectionData.instructorId);
      const teacherDocSnapshot = await getDocs(
        query(collection(db, 'teachers'), where('__name__', '==', sectionData.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || []).map((sub: Subject) =>
          sub.id === sectionData.subjectId
            ? {
                ...sub,
                sections: (sub.sections || []).map((sec: any) =>
                  sec.id === sectionData.id ? updatedSectionDetails : sec
                ),
              }
            : sub
        );

        const oldSection = sections.find((s) => s.id === sectionData.id);
        const oldRooms =
          oldSection?.schedules.map((s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName) || [];
        const newRooms = sectionData.schedules.map((s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName);
        const allRooms = [...new Set([...(existingData.assignedRooms || []), ...newRooms])].filter(
          (room) => !oldRooms.includes(room) || newRooms.includes(room)
        );

        await updateDoc(teacherRef, {
          assignedRooms: allRooms,
          assignedSubjects: updatedAssignedSubjects,
        });
      }

      setIsEditModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Section Updated Successfully',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error editing section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to update section. Please try again.',
      });
    }
  };

  const handleRemoveStudent = async (sectionId: string, studentName: string) => {
    try {
      const sectionRef = doc(db, 'sections', sectionId);
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      const updatedStudents = section.students.filter((name) => name !== studentName);
      await updateDoc(sectionRef, { students: updatedStudents });

      const student = students.find((s) => s.fullName === studentName);
      if (student) {
        const studentRef = doc(db, 'students', student.id);
        await updateDoc(studentRef, { sectionId: '' });

        if (student.rfidUid) {
          const studentRtdbRef = ref(rtdb, `/Students/${student.rfidUid}`);
          await update(studentRtdbRef, { sectionId: '' });
        }
      }

      const subjectRef = doc(db, 'subjects', section.subjectId);
      const subjectSnapshot = await getDocs(
        query(collection(db, 'subjects'), where('__name__', '==', section.subjectId))
      );
      if (!subjectSnapshot.empty) {
        const subjectDoc = subjectSnapshot.docs[0];
        const existingSections = subjectDoc.data().sections || [];
        const updatedSections = existingSections.map((sec: any) =>
          sec.id === sectionId ? { ...sec, currentEnrollment: updatedStudents.length } : sec
        );
        await updateDoc(subjectRef, { sections: updatedSections });
      }

      const teacherRef = doc(db, 'teachers', section.instructorId);
      const teacherDocSnapshot = await getDocs(
        query(collection(db, 'teachers'), where('__name__', '==', selectedSection?.instructorId || ''))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || []).map((sub: Subject) =>
          sub.id === section.subjectId
            ? {
                ...sub,
                sections: (sub.sections || []).map((sec: any) =>
                  sec.id === sectionId ? { ...sec, currentEnrollment: updatedStudents.length } : sec
                ),
              }
            : sub
        );
        await updateDoc(teacherRef, { assignedSubjects: updatedAssignedSubjects });
      }

      Swal.fire({
        icon: 'success',
        title: 'Student Removed',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error removing student:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to remove student. Please try again.',
      });
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    try {
      const sectionRef = doc(db, 'sections', sectionId);
      const section = sections.find((s) => s.id === sectionId);
      if (!section) return;

      const subjectRef = doc(db, 'subjects', section.subjectId);
      const subjectSnapshot = await getDocs(
        query(collection(db, 'subjects'), where('__name__', '==', section.subjectId))
      );
      if (!subjectSnapshot.empty) {
        const subjectDoc = subjectSnapshot.docs[0];
        const updatedSections = (subjectDoc.data().sections || []).filter((sec: any) => sec.id !== sectionId);
        await updateDoc(subjectRef, { sections: updatedSections });
      }

      const teacherRef = doc(db, 'teachers', section.instructorId);
      const teacherDocSnapshot = await getDocs(
        query(collection(db, 'teachers'), where('__name__', '==', selectedSection?.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || [])
          .map((sub: Subject) =>
            sub.id === section.subjectId
              ? { ...sub, sections: (sub.sections || []).filter((sec: any) => sec.id !== sectionId) }
              : sub
          )
          .filter((sub: Subject) => !sub.sections || sub.sections.length > 0);
        await updateDoc(teacherRef, { assignedSubjects: updatedAssignedSubjects });
      }

      await Promise.all(
        section.students.map(async (studentName) => {
          const student = students.find((s) => s.fullName === studentName);
          if (student) {
            const studentRef = doc(db, 'students', student.id);
            await updateDoc(studentRef, { sectionId: '' });
            if (student.rfidUid) {
              const studentRtdbRef = ref(rtdb, `/Students/${student.rfidUid}`);
              await update(studentRtdbRef, { sectionId: '' });
            }
          }
        })
      );

      await deleteDoc(sectionRef);

      Swal.fire({
        icon: 'success',
        title: 'Section Deleted',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error deleting section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to delete section. Please try again.',
      });
    }
  };

  const handleAssignStudents = async (studentIds: string[]) => {
    if (!selectedSection) return;

    try {
      const sectionRef = doc(db, 'sections', selectedSection.id);
      const newStudentNames = studentIds
        .map((id) => students.find((s) => s.id === id)?.fullName || '')
        .filter(Boolean);

      await updateDoc(sectionRef, {
        students: [...selectedSection.students, ...newStudentNames],
      });

      await Promise.all(
        studentIds.map(async (studentId) => {
          const studentRef = doc(db, 'students', studentId);
          await updateDoc(studentRef, { sectionId: selectedSection.id });

          const student = students.find((s) => s.id === studentId);
          if (student?.rfidUid) {
            const studentRtdbRef = ref(rtdb, `/Students/${student.rfidUid}`);
            await update(studentRtdbRef, { sectionId: selectedSection.id });
          }
        })
      );

      const subjectRef = doc(db, 'subjects', selectedSection.subjectId);
      const subjectSnapshot = await getDocs(
        query(collection(db, 'subjects'), where('__name__', '==', selectedSection.subjectId))
      );
      if (!subjectSnapshot.empty) {
        const subjectDoc = subjectSnapshot.docs[0];
        const existingSections = subjectDoc.data().sections || [];
        const updatedSections = existingSections.map((sec: any) =>
          sec.id === selectedSection.id
            ? { ...sec, currentEnrollment: selectedSection.students.length + newStudentNames.length }
            : sec
        );
        await updateDoc(subjectRef, { sections: updatedSections });
      }

      const teacherRef = doc(db, 'teachers', selectedSection.instructorId);
      const teacherDocSnapshot = await getDocs(
        query(collection(db, 'teachers'), where('__name__', '==', selectedSection?.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || []).map((sub: Subject) =>
          sub.id === selectedSection.subjectId
            ? {
                ...sub,
                sections: (sub.sections || []).map((sec: any) =>
                  sec.id === selectedSection.id
                    ? { ...sec, currentEnrollment: selectedSection.students.length + newStudentNames.length }
                    : sec
                ),
              }
            : sub
        );
        await updateDoc(teacherRef, { assignedSubjects: updatedAssignedSubjects });
      }

      setIsAssignModalOpen(false);
      Swal.fire({
        icon: 'success',
        title: 'Students Assigned Successfully',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      console.error('Error assigning students:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to assign students. Please try again.',
      });
    }
  };

  const SkeletonCard = () => (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 animate-pulse">
      <div className="h-6 w-32 bg-gray-200 rounded mb-2"></div>
      <div className="h-4 w-48 bg-gray-200 rounded mb-1"></div>
      <div className="h-4 w-40 bg-gray-200 rounded"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="ml-[80px] lg:ml-64 p-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-gray-800">Section Management</h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-200"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Add Section
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-10">
              <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No sections available. Add a section to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sections.map((section) => {
                const instructor = instructors.find((i) => i.rfidUid === section.instructorRfidUid);
                const subject = subjects.find((s) => s.id === section.subjectId);
                return (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
                        <p className="text-sm text-gray-600">
                          Instructor: {instructor?.fullName || 'Not Assigned'}
                        </p>
                        <p className="text-sm text-gray-600">RFID UID: {section.instructorRfidUid || 'N/A'}</p>
                        <p className="text-sm text-gray-600">
                          Subject: {subject?.name || 'N/A'} ({subject?.code || ''})
                        </p>
                        <p className="text-sm text-gray-600">Code: {section.code}</p>
                      </div>
                      <UserGroupIcon className="w-8 h-8 text-indigo-600" />
                    </div>

                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                        <CalendarIcon className="w-5 h-5 mr-1" />
                        Schedules ({section.schedules?.length || 0})
                      </h3>
                      <div className="max-h-32 overflow-y-auto space-y-2 pr-2">
                        <AnimatePresence>
                          {section.schedules?.length > 0 ? (
                            section.schedules.map((schedule, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg"
                              >
                                {schedule.day}: {schedule.startTime} - {schedule.endTime} ({schedule.roomName})
                              </motion.div>
                            ))
                          ) : (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-gray-500 text-center py-2"
                            >
                              No schedules assigned.
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Enrolled Students ({section.students?.length || 0})
                      </h3>
                      <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
                        <AnimatePresence>
                          {section.students?.length > 0 ? (
                            section.students.map((studentName) => (
                              <motion.div
                                key={studentName}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                              >
                                <div className="flex items-center">
                                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                                    <span className="text-indigo-600 font-medium">{studentName[0]}</span>
                                  </div>
                                  <p className="text-sm font-medium text-gray-900">{studentName}</p>
                                </div>
                                <button
                                  onClick={() =>
                                    Swal.fire({
                                      title: 'Remove Student',
                                      text: `Are you sure you want to remove ${studentName} from ${section.name}?`,
                                      icon: 'warning',
                                      showCancelButton: true,
                                      confirmButtonColor: '#ef4444',
                                      cancelButtonColor: '#6b7280',
                                      confirmButtonText: 'Yes, remove',
                                    }).then((result) => {
                                      if (result.isConfirmed) {
                                        handleRemoveStudent(section.id, studentName);
                                      }
                                    })
                                  }
                                  className="text-red-500 hover:text-red-700 transition-colors duration-150"
                                >
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              </motion.div>
                            ))
                          ) : (
                            <motion.p
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-sm text-gray-500 text-center py-4"
                            >
                              No students enrolled yet.
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => {
                          setSelectedSection(section);
                          setIsEditModalOpen(true);
                        }}
                        className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg shadow hover:bg-yellow-700 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <PencilIcon className="w-5 h-5" />
                        Edit Section
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSection(section);
                          setIsAssignModalOpen(true);
                        }}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg shadow hover:bg-green-700 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <PlusIcon className="w-5 h-5" />
                        Assign Students
                      </button>
                      <button
                        onClick={() =>
                          Swal.fire({
                            title: 'Delete Section',
                            text: `Are you sure you want to delete ${section.name}?`,
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#ef4444',
                            cancelButtonColor: '#6b7280',
                            confirmButtonText: 'Yes, delete',
                          }).then((result) => {
                            if (result.isConfirmed) {
                              handleDeleteSection(section.id);
                            }
                          })
                        }
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <TrashIcon className="w-5 h-5" />
                        Delete Section
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AddSectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddSection}
        instructors={instructors}
        subjects={subjects}
      />
      <AddSectionModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={(data) => handleEditSection(data as EditSectionData)} // Cast to ensure id is present
        instructors={instructors}
        subjects={subjects}
        initialData={selectedSection ? { ...selectedSection, id: selectedSection.id } : undefined}
      />
      <AssignStudentsModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        onSubmit={handleAssignStudents}
        students={students}
      />
    </div>
  );
};

export default AdminSectionPage;