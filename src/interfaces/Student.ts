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
  rfidUid?: string;
  createdAt: string;
  schedule?: {
    days: string[];
    startTime: string;
    endTime: string;
  };
} 