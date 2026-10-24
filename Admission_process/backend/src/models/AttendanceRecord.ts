import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Student from './Student';
import FacultyAssignment from './FacultyAssignment';
import Department from './Department';
import Subject from './Subject';
import AttendanceSession from './AttendanceSession';

class AttendanceRecord extends Model {
  public id!: string;
  public attendanceSessionId!: string | null;
  public studentId!: string;
  public facultyAssignmentId!: string;
  public departmentId!: string;
  public subjectId!: string;
  public semester!: number;
  public section!: string | null;
  public academicYear!: string;
  public date!: Date;
  public sessionPeriod!: number;
  public status!: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    attendanceSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'attendance_sessions',
        key: 'id',
      },
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
    },
    facultyAssignmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'faculty_assignments',
        key: 'id',
      },
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'departments',
        key: 'id',
      },
    },
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subjects',
        key: 'id',
      },
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    section: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    sessionPeriod: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.ENUM('PRESENT', 'ABSENT', 'EXCUSED'),
      allowNull: false,
      defaultValue: 'PRESENT',
    },
  },
  {
    sequelize: db,
    tableName: 'attendance_records',
    timestamps: true,
    indexes: [
      { fields: ['attendanceSessionId'] },
      { fields: ['studentId'] },
      { fields: ['facultyAssignmentId'] },
      { fields: ['departmentId'] },
      { fields: ['subjectId'] },
      { fields: ['date'] },
      { fields: ['status'] },
      {
        fields: ['studentId', 'facultyAssignmentId', 'date', 'sessionPeriod'],
        unique: true,
        name: 'attendance_records_student_id_faculty_assignment_id_date_sessio',
      },
    ],
  }
);

AttendanceRecord.belongsTo(AttendanceSession, { as: 'session', foreignKey: 'attendanceSessionId' });
AttendanceRecord.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });
AttendanceRecord.belongsTo(FacultyAssignment, { as: 'facultyAssignment', foreignKey: 'facultyAssignmentId' });
AttendanceRecord.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
AttendanceRecord.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });

export default AttendanceRecord;
