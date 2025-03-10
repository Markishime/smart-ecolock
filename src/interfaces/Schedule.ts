export interface Schedule {
    day: string;         // Day of the week (e.g., "Monday")
    startTime: string;   // Start time (e.g., "08:00")
    endTime: string;     // End time (e.g., "10:00")
    room?: string;       // Room number or location (optional, e.g., "Room 101")
    subject?: string;    // Subject name (optional, e.g., "Mathematics")
  }