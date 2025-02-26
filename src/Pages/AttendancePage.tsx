import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'framer-motion';
import {
  UserIcon,
  CheckIcon,
  XMarkIcon,
  CalendarIcon,
  FolderIcon,
  AcademicCapIcon,
  BookOpenIcon,
  IdentificationIcon,
  UsersIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { useAuth } from './AuthContext';
import { Instructor } from '../types';

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  semester?: string;
}

interface Schedule {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  semester?: string;
  subjectCode: string;
}

interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: Student[];
}

interface Student {
  id: string;
  name: string;
  section: string;
  attendance: boolean;
  timeIn?: string;
  studentId: string;
  course: string;
  year: string;
  subjects: string[];
}

const AttendancePage: React.FC<{ instructorfullName: string }> = ({ instructorfullName }) => {
  const { currentUser } = useAuth();
  const [instructor, setInstructor] = useState<Instructor | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const fetchInstructorData = async () => {
      try {
        const instructorQuery = query(
          collection(db, 'teachers'),
          where('fullName', '==', instructorfullName)
        );
        const instructorSnapshot = await getDocs(instructorQuery);

        if (instructorSnapshot.docs.length > 0) {
          const docData = instructorSnapshot.docs[0].data();
          const instructorData: Instructor = {
            id: instructorSnapshot.docs[0].id,
            name: docData.fullName,
            email: docData.email,
            department: docData.department,
            subjects: docData.subjects || [],
            schedules: docData.schedules || [],
            sections: docData.sections || []
          };
          setInstructor(instructorData);

          const sectionsQuery = query(
            collection(db, 'teachers'),
            where('instructor', '==', instructorfullName)
          );
          const sectionsSnapshot = await getDocs(sectionsQuery);

          const sectionsData = await Promise.all(
            sectionsSnapshot.docs.map(async (doc) => {
              const section = { id: doc.id, ...doc.data() } as Section;

              const studentsQuery = query(
                collection(db, 'students'),
                where('section', '==', section.name),
                where('course', '==', section.course),
                where('subject', '==', section.subjectCode)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              section.students = studentsSnapshot.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              })) as Student[];

              return section;
            })
          );

          setSections(sectionsData);
        } else {
          Swal.fire('Error', 'Instructor not found.', 'error');
        }
      } catch (error) {
        Swal.fire('Error', error instanceof Error ? error.message : 'Failed to load data', 'error');
      }
    };

    fetchInstructorData();
  }, [instructorfullName]);

  const handleAttendance = async (studentId: string, isPresent: boolean) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        attendance: isPresent,
        timeIn: isPresent ? new Date().toISOString() : null,
      });

      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          students: section.students.map((student) =>
            student.id === studentId ? { ...student, attendance: isPresent } : student
          ),
        }))
      );

      Swal.fire({
        icon: 'success',
        title: 'Updated!',
        showConfirmButton: false,
        timer: 1500,
      });
    } catch (error) {
      Swal.fire('Error', error instanceof Error ? error.message : 'Update failed', 'error');
    }
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="ml-64 flex-1">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <ClipboardDocumentCheckIcon className="w-8 h-8 text-indigo-600" />
              {selectedSubject ? (
                <>
                  {instructor?.subjects?.find((s) => s.code === selectedSubject)?.name || 'Subject'} - Attendance
                </>
              ) : (
                'Select a Subject'
              )}
            </h1>
          </div>

          {selectedSubject && selectedSchedule ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {sections
                  .filter((section) => section.subjectCode === selectedSubject)
                  .map((section) => (
                    <motion.div
                      key={section.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`bg-white p-6 rounded-xl shadow-sm cursor-pointer transition-all ${
                        selectedSection === section.id
                          ? 'ring-2 ring-indigo-500'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() =>
                        setSelectedSection((prev) =>
                          prev === section.id ? '' : section.id
                        )
                      }
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <FolderIcon className="w-6 h-6 text-indigo-500" />
                        <h3 className="text-xl font-semibold">{section.name}</h3>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Course:</span>{' '}
                          {section.course}
                        </p>
                        <p>
                          <span className="font-medium">Subject:</span>{' '}
                          {section.subjectCode}
                        </p>
                        <p>
                          <span className="font-medium">Students:</span>{' '}
                          {section.students.length}/{section.maxStudents}
                        </p>
                        <p>
                          <span className="font-medium">Schedule:</span>{' '}
                          {selectedSchedule.days.join(', ')} {selectedSchedule.startTime} -{' '}
                          {selectedSchedule.endTime}
                        </p>
                      </div>
                    </motion.div>
                  ))}
              </div>

              {selectedSection && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-white p-6 rounded-xl shadow-sm"
                >
                  <h3 className="text-xl font-semibold mb-6 flex items-center gap-3">
                    <UsersIcon className="w-6 h-6 text-gray-500" />
                    Students in {sections.find((s) => s.id === selectedSection)?.name}
                  </h3>

                  <div className="grid gap-4">
                    {sections
                      .find((s) => s.id === selectedSection)
                      ?.students.map((student) => (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-medium">{student.name}</p>
                              <p className="text-sm text-gray-500">
                                ID: {student.studentId}
                              </p>
                              <p className="text-sm text-gray-500">
                                Section: {student.section}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">
                                Course: {student.course}
                              </p>
                              <p className="text-sm text-gray-500">
                                Year: {student.year}
                              </p>
                              {student.timeIn && (
                                <p className="text-sm text-gray-500">
                                  Last attended:{' '}
                                  {new Date(student.timeIn).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAttendance(student.id, true)}
                              className={`p-2 rounded-lg ${
                                student.attendance
                                  ? 'bg-green-500'
                                  : 'bg-gray-200'
                              } hover:bg-green-600`}
                            >
                              <CheckIcon className="w-5 h-5 text-white" />
                            </button>
                            <button
                              onClick={() => handleAttendance(student.id, false)}
                              className={`p-2 rounded-lg ${
                                !student.attendance
                                  ? 'bg-red-500'
                                  : 'bg-gray-200'
                              } hover:bg-red-600`}
                            >
                              <XMarkIcon className="w-5 h-5 text-white" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <BookOpenIcon className="w-16 h-16 mx-auto mb-4" />
              <h2 className="text-xl font-semibold">
                Select a Subject and Schedule to View Sections
              </h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;