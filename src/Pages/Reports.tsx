import React, { useState, useEffect } from 'react';

const Reports: React.FC = () => {
    const [sections, setSections] = useState<{ name: string; room: string; schedule: string; students: { id: number; name: string; section: string; attendance: string; }[] }[]>([
        { name: 'A', room: 'Room 101', schedule: 'MWF 8:00-9:00 AM', students: [] },
        { name: 'B', room: 'Room 102', schedule: 'TTH 9:00-10:00 AM', students: [] },
        { name: 'C', room: 'Room 201', schedule: 'MWF 10:00-11:00 AM', students: [] },
    ]);
    const [selectedSection, setSelectedSection] = useState<{ name: string; room: string; schedule: string; students: { id: number; name: string; section: string; attendance: string; }[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);


    useEffect(() => {
        // Simulate fetching real-time attendance data.  REPLACE THIS with your actual API call.
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                // Example using fetch (replace with your actual API endpoint)
                // const response = await fetch('/api/attendance'); 
                // if (!response.ok) {
                //     throw new Error(`HTTP error! status: ${response.status}`);
                // }
                // const data = await response.json();

                // Mock Data (for demonstration) - Replace with real data
                const mockData = [
                    { id: 1, name: 'John Doe', section: 'A', attendance: 'Present' },
                    { id: 2, name: 'Jane Smith', section: 'B', attendance: 'Absent' },
                    { id: 3, name: 'Sam Johnson', section: 'A', attendance: 'Present' },
                    { id: 4, name: 'Alice Lee', section: 'C', attendance: 'Present' },
                    { id: 5, name: 'Bob Williams', section: 'B', attendance: 'Present' },
                    { id: 6, name: 'Charlie Brown', section: 'A', attendance: 'Absent' },
                ];


                // Update sections with student data
                setSections(prevSections => {
                    return prevSections.map(section => {
                        const sectionStudents = mockData.filter(student => student.section === section.name);
                        return { ...section, students: sectionStudents };
                    });
                });

            } catch (err) {
                setError(error);
                console.error("Error fetching attendance:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAttendance();
    }, []); // Empty dependency array ensures this runs only once on mount


    const handleSectionSelect = (section: { name: string; room: string; schedule: string; students: { id: number; name: string; section: string; attendance: string; }[] } | null) => {
        setSelectedSection(section);
    };

    if (loading) {
        return <div>Loading attendance data...</div>;
    }

    if (error) {
        return <div>Error: {error?.message}</div>;
    }

    return (
        <div>
            <h1>Classroom Reports</h1>

            <div>
                <h2>Select Section:</h2>
                <select value={selectedSection?.name || ''} onChange={(e) => handleSectionSelect(sections.find(s => s.name === e.target.value) || null)}>
                    <option value="">Select a section</option>
                    {sections.map(section => (
                        <option key={section.name} value={section.name}>
                            {section.name} ({section.room} - {section.schedule})
                        </option>
                    ))}
                </select>
            </div>

            {selectedSection && (
                <div>
                    <h2>{selectedSection.name} - {selectedSection.room} ({selectedSection.schedule})</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Student ID</th>
                                <th>Student Name</th>
                                <th>Attendance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedSection.students.map(student => (
                                <tr key={student.id}>
                                    <td>{student.id}</td>
                                    <td>{student.name}</td>
                                    <td>{student.attendance}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Reports;