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
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';

interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  section: string;
  course: string;
  subject: string;
  attendance: boolean;
  lastAttendance?: Date;
}

interface Subject {
  id: string;
  code: string;
  name: string;
  description?: string;
  credits: number;
  semester?: string;
}

interface Teacher {
  id: string;
  fullName: string;
  email: string;
  department: string;
  subjects: Subject[];
  sections: Section[];
}

interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: Student[];
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


const AttendancePage: React.FC<{ instructorfullName: string }> = ({ instructorfullName }) => {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teacher details
        const teacherQuery = query(collection(db, 'teachers'), where('id', '==', instructorfullName));
        const teacherSnapshot = await getDocs(teacherQuery);
        if (teacherSnapshot.docs.length > 0) {
          const teacherData = { id: teacherSnapshot.docs[0].id, ...teacherSnapshot.docs[0].data() } as Teacher;
          setTeacher(teacherData);

          // Fetch sections assigned to the teacher
          const sectionsQuery = query(
            collection(db, 'teachers'),
            where('instructor', '==', instructorfullName)
          );
          const sectionsSnapshot = await getDocs(sectionsQuery);

          const sectionsData = await Promise.all(
            sectionsSnapshot.docs.map(async (doc) => {
              const section = { id: doc.id, ...doc.data() } as Section;

              // Fetch students for the section
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
        }
      } catch (error) {
        Swal.fire('Error', error instanceof Error ? error.message : 'Failed to load data', 'error');
      }
    };

    fetchData();
  }, [instructorfullName]);

  const handleAttendance = async (studentId: string, isPresent: boolean) => {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        attendance: isPresent,
        lastAttendance: new Date(),
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-indigo-800 text-white p-6">
        <div className="flex items-center gap-3 mb-8">
          <IdentificationIcon className="w-8 h-8 text-indigo-200" />
          <h2 className="text-xl font-bold">Teacher Details</h2>
        </div>
        {teacher && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-indigo-200">Name</p>
              <p className="font-semibold">{teacher.fullName}</p>
            </div>
            <div>
              <p className="text-sm text-indigo-200">Email</p>
              <p className="font-semibold">{teacher.email}</p>
            </div>
            <div>
              <p className="text-sm text-indigo-200">Department</p>
              <p className="font-semibold">{teacher.department}</p>
            </div>
            <div>
              <p className="text-sm text-indigo-200">Assigned Subjects</p>
              <ul className="space-y-1">
               {teacher.subjects.map((subject) => (
                  <li key={subject.code} className="font-semibold">
                    {subject.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
 
      {/* Main Content */}
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <AcademicCapIcon className="w-8 h-8 text-indigo-600" />
              Attendance Management
            </h1>
          </div>

          {/* Sections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {sections.map((section) => (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white p-6 rounded-xl shadow-sm cursor-pointer transition-all ${
                  selectedSection === section.id ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedSection((prev) => (prev === section.id ? '' : section.id))}
              >
                <div className="flex items-center gap-3 mb-4">
                  <FolderIcon className="w-6 h-6 text-indigo-500" />
                  <h3 className="text-xl font-semibold">{section.name}</h3>
                </div>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium">Course:</span> {section.course}
                  </p>
                  <p>
                    <span className="font-medium">Subject:</span> {section.subjectCode}
                  </p>
                  <p>
                    <span className="font-medium">Students:</span> {section.students.length}/{section.maxStudents}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Students List */}
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
                      <div>
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-sm text-gray-500">ID: {student.idNumber}</p>
                        {student.lastAttendance && (
                          <p className="text-sm text-gray-500">
                            Last attended: {new Date(student.lastAttendance).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAttendance(student.id, true)}
                          className={`p-2 rounded-lg ${
                            student.attendance ? 'bg-green-500' : 'bg-gray-200'
                          } hover:bg-green-600`}
                        >
                          <CheckIcon className="w-5 h-5 text-white" />
                        </button>
                        <button
                          onClick={() => handleAttendance(student.id, false)}
                          className={`p-2 rounded-lg ${
                            !student.attendance ? 'bg-red-500' : 'bg-gray-200'
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
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;