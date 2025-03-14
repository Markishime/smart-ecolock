export interface Student {
  id: string;
  fullName: string;
  idNumber: string;
  email: string;
  department: string;
  section: string;
  year: string;
  major: string;
  yearLevel: string;
  courses?: string[];
  attendance: {
    [courseId: string]: {
      present: number;
      absent: number;
      late: number;
    };
  };
  grades: {
    [courseId: string]: number;
  };
  status?: 'present' | 'absent' | 'late';
  rfidUid?: string;
  createdAt: string;
  attendancePercentage?: number;
  completedAssignments?: number;
  totalAssignments?: number;
  currentGrade?: number;
  lastActivity?: string;
  performanceTrend?: number;
  schedule?: {
    days: string[];
    startTime: string;
    endTime: string;
  };
} 