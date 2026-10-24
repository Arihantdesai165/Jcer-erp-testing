import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AttendanceSession from './AttendanceSession';
import FacultyAssignment from './FacultyAssignment';
import AttendanceBackupFile from './AttendanceBackupFile';

class AttendanceBackupJob extends Model {
  public id!: string;
  public attendanceSessionId!: string | null;
  public facultyAssignmentId!: string;
  public backupFileId!: string | null;
  public action!: 'CREATE' | 'UPDATE' | 'CORRECTION';
  public status!: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  public attemptCount!: number;
  public maxAttempts!: number;
  public lastAttemptAt!: Date | null;
  public nextAttemptAt!: Date | null;
  public errorMessage!: string | null;
  public completedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceBackupJob.init(
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
    facultyAssignmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'faculty_assignments',
        key: 'id',
      },
    },
    backupFileId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'attendance_backup_files',
        key: 'id',
      },
    },
    action: {
      type: DataTypes.ENUM('CREATE', 'UPDATE', 'CORRECTION'),
      allowNull: false,
      defaultValue: 'UPDATE',
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    attemptCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxAttempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
    },
    lastAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    nextAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'attendance_backup_jobs',
    timestamps: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['facultyAssignmentId'] },
      { fields: ['attendanceSessionId'] },
      { fields: ['createdAt'] },
    ],
  }
);

AttendanceBackupJob.belongsTo(AttendanceSession, { as: 'session', foreignKey: 'attendanceSessionId' });
AttendanceBackupJob.belongsTo(FacultyAssignment, { as: 'facultyAssignment', foreignKey: 'facultyAssignmentId' });
AttendanceBackupJob.belongsTo(AttendanceBackupFile, { as: 'backupFile', foreignKey: 'backupFileId' });

export default AttendanceBackupJob;
