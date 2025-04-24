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
import { 
  UserGroupIcon, 
  PlusIcon, 
  TrashIcon, 
  CalendarIcon, 
  PencilIcon,
  AcademicCapIcon,
  ArrowsUpDownIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
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

interface AddSectionData {
  name: string;
  code: string;
  instructorRfidUid: string;
  instructorId: string;
  subjectId: string;
  schedules: Schedule[];
}

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
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

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
      // Add new section to 'sections' collection
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

      // Update subject's sections array without overwriting existing sections
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
        // If subject doesn't exist, create it with the new section (unlikely in this context)
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

      // Update instructor's assignedSubjects without overwriting existing data
      const teacherRef = doc(db, 'teachers', sectionData.instructorId);
      const teacherSnapshot = await getDocs(
        query(collection(db, 'teachers'), where('__name__', '==', sectionData.instructorId))
      );
      if (!teacherSnapshot.empty) {
        const teacherDoc = teacherSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const existingAssignedSubjects = existingData.assignedSubjects || [];

        // Check if the subject is already assigned to the instructor
        const subjectIndex = existingAssignedSubjects.findIndex(
          (sub: any) => sub.id === sectionData.subjectId
        );
        let updatedAssignedSubjects;
        if (subjectIndex >= 0) {
          // Append new section to existing subject's sections
          updatedAssignedSubjects = existingAssignedSubjects.map((sub: any, idx: number) =>
            idx === subjectIndex
              ? { ...sub, sections: [...(sub.sections || []), newSectionDetails] }
              : sub
          );
        } else {
          // Add new subject with the new section
          updatedAssignedSubjects = [
            ...existingAssignedSubjects,
            {
              id: sectionData.subjectId,
              name: subjects.find((s) => s.id === sectionData.subjectId)?.name || 'Unknown',
              code: subjects.find((s) => s.id === sectionData.subjectId)?.code || '',
              sections: [newSectionDetails],
            },
          ];
        }

        // Update assignedRooms without duplicating
        const currentRooms = existingData.assignedRooms || [];
        const newRooms = sectionData.schedules
          .map((s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName)
          .filter((room) => !currentRooms.includes(room));

        await updateDoc(teacherRef, {
          assignedRooms: [...currentRooms, ...newRooms],
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
      // Update the specific section in 'sections' collection
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

      // Update only the edited section in subject's sections array
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

      // Handle instructor update without affecting other sections
      const oldSection = sections.find((s) => s.id === sectionData.id);
      const oldInstructorId = oldSection?.instructorId;
      const newInstructorId = sectionData.instructorId;

      if (oldInstructorId !== newInstructorId) {
        // Remove section from old instructor's assignedSubjects
        if (oldInstructorId) {
          const oldTeacherRef = doc(db, 'teachers', oldInstructorId);
          const oldTeacherSnapshot = await getDocs(
            query(collection(db, 'teachers'), where('__name__', '==', oldInstructorId))
          );
          if (!oldTeacherSnapshot.empty) {
            const oldTeacherDoc = oldTeacherSnapshot.docs[0];
            const oldData = oldTeacherDoc.data();
            const oldAssignedSubjects = oldData.assignedSubjects || [];
            const updatedOldAssignedSubjects = oldAssignedSubjects.map((sub: any) =>
              sub.id === sectionData.subjectId
                ? { ...sub, sections: sub.sections.filter((sec: any) => sec.id !== sectionData.id) }
                : sub
            ).filter((sub: any) => !sub.sections || sub.sections.length > 0);
            const oldRooms = oldData.assignedRooms || [];
            const sectionRooms = sectionData.schedules.map(
              (s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName
            );
            const updatedOldRooms = oldRooms.filter((room: string) => !sectionRooms.includes(room));
            await updateDoc(oldTeacherRef, {
              assignedRooms: updatedOldRooms,
              assignedSubjects: updatedOldAssignedSubjects,
            });
          }
        }

        // Add section to new instructor's assignedSubjects
        const newTeacherRef = doc(db, 'teachers', newInstructorId);
        const newTeacherSnapshot = await getDocs(
          query(collection(db, 'teachers'), where('__name__', '==', newInstructorId))
        );
        if (!newTeacherSnapshot.empty) {
          const newTeacherDoc = newTeacherSnapshot.docs[0];
          const newData = newTeacherDoc.data();
          const newAssignedSubjects = newData.assignedSubjects || [];
          const subjectIndex = newAssignedSubjects.findIndex(
            (sub: any) => sub.id === sectionData.subjectId
          );
          let updatedNewAssignedSubjects;
          if (subjectIndex >= 0) {
            updatedNewAssignedSubjects = newAssignedSubjects.map((sub: any, idx: number) =>
              idx === subjectIndex
                ? { ...sub, sections: [...(sub.sections || []), updatedSectionDetails] }
                : sub
            );
          } else {
            updatedNewAssignedSubjects = [
              ...newAssignedSubjects,
              {
                id: sectionData.subjectId,
                name: subjects.find((s) => s.id === sectionData.subjectId)?.name || 'Unknown',
                code: subjects.find((s) => s.id === sectionData.subjectId)?.code || '',
                sections: [updatedSectionDetails],
              },
            ];
          }
          const currentRooms = newData.assignedRooms || [];
          const newRooms = sectionData.schedules
            .map((s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName)
            .filter((room) => !currentRooms.includes(room));
          await updateDoc(newTeacherRef, {
            assignedRooms: [...currentRooms, ...newRooms],
            assignedSubjects: updatedNewAssignedSubjects,
          });
        }
      } else {
        // Update existing instructor's assignedSubjects for the edited section
        const teacherRef = doc(db, 'teachers', sectionData.instructorId);
        const teacherSnapshot = await getDocs(
          query(collection(db, 'teachers'), where('__name__', '==', sectionData.instructorId))
        );
        if (!teacherSnapshot.empty) {
          const teacherDoc = teacherSnapshot.docs[0];
          const existingData = teacherDoc.data();
          const updatedAssignedSubjects = (existingData.assignedSubjects || []).map((sub: any) =>
            sub.id === sectionData.subjectId
              ? {
                  ...sub,
                  sections: (sub.sections || []).map((sec: any) =>
                    sec.id === sectionData.id ? updatedSectionDetails : sec
                  ),
                }
              : sub
          );

          const oldRooms =
            oldSection?.schedules.map((s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName) || [];
          const newRooms = sectionData.schedules.map(
            (s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName
          );
          const currentRooms = existingData.assignedRooms || [];
          const updatedRooms = [...new Set([...currentRooms.filter((r: string) => !oldRooms.includes(r)), ...newRooms])];

          await updateDoc(teacherRef, {
            assignedRooms: updatedRooms,
            assignedSubjects: updatedAssignedSubjects,
          });
        }
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
        query(collection(db, 'teachers'), where('__name__', '==', section.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || []).map((sub: any) =>
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
        query(collection(db, 'teachers'), where('__name__', '==', section.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || [])
          .map((sub: any) =>
            sub.id === section.subjectId
              ? { ...sub, sections: (sub.sections || []).filter((sec: any) => sec.id !== sectionId) }
              : sub
          )
          .filter((sub: any) => !sub.sections || sub.sections.length > 0);
        const sectionRooms = section.schedules.map(
          (s) => rooms.find((r) => r.name === s.roomName)?.id || s.roomName
        );
        const updatedRooms = (existingData.assignedRooms || []).filter(
          (room: string) => !sectionRooms.includes(room)
        );
        await updateDoc(teacherRef, {
          assignedRooms: updatedRooms,
          assignedSubjects: updatedAssignedSubjects,
        });
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
        query(collection(db, 'teachers'), where('__name__', '==', selectedSection.instructorId))
      );
      if (!teacherDocSnapshot.empty) {
        const teacherDoc = teacherDocSnapshot.docs[0];
        const existingData = teacherDoc.data();
        const updatedAssignedSubjects = (existingData.assignedSubjects || []).map((sub: any) =>
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
      <div className="h-4 w-40 bg-gray-200 rounded mb-4"></div>
      <div className="h-20 bg-gray-100 rounded-lg mb-4"></div>
      <div className="flex gap-3">
        <div className="h-10 bg-gray-200 rounded-lg flex-1"></div>
        <div className="h-10 bg-gray-200 rounded-lg flex-1"></div>
        <div className="h-10 bg-gray-200 rounded-lg flex-1"></div>
      </div>
    </div>
  );

  const toggleExpandSection = (sectionId: string) => {
    if (expandedSection === sectionId) {
      setExpandedSection(null);
    } else {
      setExpandedSection(sectionId);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <AdminSidebar />
      <div className="ml-[80px] lg:ml-64 p-4 sm:p-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              <UserGroupIcon className="w-8 h-8 text-indigo-600 mr-3" />
              Section Management
            </h1>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 active:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 group"
            >
              <PlusIcon className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
              <span>Add Section</span>
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-200">
              <UserGroupIcon className="w-20 h-20 text-gray-300 mx-auto mb-6" />
              <p className="text-xl text-gray-500 mb-6">No sections available</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors duration-200"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Your First Section
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {sections.map((section) => {
                const instructor = instructors.find((i) => i.rfidUid === section.instructorRfidUid);
                const subject = subjects.find((s) => s.id === section.subjectId);
                const isExpanded = expandedSection === section.id;
                return (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6 pb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 mb-1">{section.name}</h2>
                          <div className="flex items-center mb-1 text-sm text-gray-600">
                            <AcademicCapIcon className="w-4 h-4 mr-1 text-indigo-500" />
                            <span className="font-medium">
                              {subject?.name || 'N/A'} <span className="text-gray-400">({subject?.code || ''})</span>
                            </span>
                          </div>
                          <div className="flex items-center text-sm text-gray-600">
                            <UserGroupIcon className="w-4 h-4 mr-1 text-indigo-500" />
                            <span>{instructor?.fullName || 'Not Assigned'}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Code: {section.code}</p>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-semibold mb-1">
                            {section.students?.length || 0} students
                          </div>
                          <div className="text-xs text-gray-400">
                            RFID: {section.instructorRfidUid ? section.instructorRfidUid.substring(0, 8) + '...' : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-medium text-gray-700 flex items-center">
                            <ClockIcon className="w-4 h-4 mr-1 text-indigo-600" />
                            Schedules
                          </h3>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-500">
                            {section.schedules?.length || 0}
                          </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                          <AnimatePresence>
                            {section.schedules?.length > 0 ? (
                              section.schedules.map((schedule, index) => (
                                <motion.div
                                  key={index}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 10 }}
                                  transition={{ duration: 0.2 }}
                                  className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg flex items-center"
                                >
                                  <CalendarIcon className="w-3.5 h-3.5 mr-1 text-indigo-500 flex-shrink-0" />
                                  <span className="font-medium mr-1">{schedule.day}:</span>
                                  <span className="mr-1">{schedule.startTime} - {schedule.endTime}</span>
                                  <span className="ml-auto text-gray-500 truncate max-w-[80px]" title={schedule.roomName}>
                                    {schedule.roomName}
                                  </span>
                                </motion.div>
                              ))
                            ) : (
                              <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="text-xs text-gray-500 text-center py-2"
                              >
                                No schedules assigned.
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100">
                      <div 
                        onClick={() => toggleExpandSection(section.id)}
                        className="flex justify-between items-center px-6 py-3 text-sm font-medium text-indigo-700 cursor-pointer hover:bg-indigo-50 transition-colors duration-150"
                      >
                        <span>Enrolled Students ({section.students?.length || 0})</span>
                        <ArrowsUpDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                      
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="px-6 pb-4"
                          >
                            <div className="bg-gray-50 rounded-xl p-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-200 scrollbar-track-gray-100">
                              {section.students?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {section.students.map((studentName) => (
                                    <motion.div
                                      key={studentName}
                                      initial={{ opacity: 0, y: 5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -5 }}
                                      transition={{ duration: 0.2 }}
                                      className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      <div className="flex items-center overflow-hidden">
                                        <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                                          <span className="text-indigo-600 font-medium text-xs">{studentName[0]}</span>
                                        </div>
                                        <p className="text-xs font-medium text-gray-900 truncate">
                                          {studentName}
                                        </p>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
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
                                          });
                                        }}
                                        className="text-red-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </button>
                                    </motion.div>
                                  ))}
                                </div>
                              ) : (
                                <motion.p
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="text-sm text-gray-500 text-center py-6"
                                >
                                  No students enrolled yet.
                                </motion.p>
                              )}
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSection(section);
                                setIsAssignModalOpen(true);
                              }}
                              className="mt-3 w-full py-2 bg-indigo-50 text-indigo-700 rounded-lg shadow-sm hover:bg-indigo-100 transition-colors duration-200 flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <PlusIcon className="w-4 h-4" />
                              Assign More Students
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <div className="p-3 flex gap-2 border-t border-gray-100 bg-gray-50">
                      <button
                        onClick={() => {
                          setSelectedSection(section);
                          setIsEditModalOpen(true);
                        }}
                        className="flex-1 px-3 py-2 bg-amber-500 text-white rounded-lg shadow hover:bg-amber-600 active:bg-amber-700 transition-colors duration-200 flex items-center justify-center gap-1 text-sm"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      {!isExpanded && (
                        <button
                          onClick={() => {
                            setSelectedSection(section);
                            setIsAssignModalOpen(true);
                          }}
                          className="flex-1 px-3 py-2 bg-emerald-500 text-white rounded-lg shadow hover:bg-emerald-600 active:bg-emerald-700 transition-colors duration-200 flex items-center justify-center gap-1 text-sm"
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">Assign</span>
                        </button>
                      )}
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
                        className="flex-1 px-3 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600 active:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-1 text-sm"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
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
        onSubmit={(data) => handleEditSection(data as EditSectionData)}
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