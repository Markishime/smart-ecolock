export interface Schedule {
  id: string;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
  semester?: string;
  subjectCode: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface Section {
  id: string;
  name: string;
  course: string;
  subjectCode: string;
  maxStudents: number;
  students: string[];
  schedule: Schedule;
  days: string[];
  startTime: string;
  endTime: string;
  roomNumber: string;
}

export interface Subject {
  id?: string;
  code: string;
  name: string;
  description?: string;
  semester?: string;
  department?: string;
  teacherName?: string;
  credits?: number;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

export interface Instructor {
  id?: string;
  name: string;
  fullName?: string;
  email: string;
  department?: string;
  subjects?: Subject[];
  schedules?: Schedule[];
  sections?: Section[];
  [key: string]: any;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export interface Student {
  id: string;
  name: string;
  section: string;
  attendance: boolean;
  timeIn?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  subject: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  timestamp: any;
}

export interface DashboardStats {
  totalStudents: number;
  totalClasses: number;
  attendanceRate: number;
  onTimeRate: number;
}

export interface SettingsSection {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  content: React.ReactNode;
}

export interface DepartmentSubjects {
  [department: string]: Subject[];
}
