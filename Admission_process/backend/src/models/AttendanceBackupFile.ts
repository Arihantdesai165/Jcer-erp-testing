import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';
import FacultyAssignment from './FacultyAssignment';

class AttendanceBackupFile extends Model {
  public id!: string;
  public academicYear!: string;
  public departmentId!: string;
  public semester!: number;
  public section!: string;
  public subjectId!: string;
  public facultyAssignmentId!: string | null;
  public googleDriveFolderId!: string;
  public googleDriveFileId!: string;
  public fileName!: string;
  public status!: 'SYNCED' | 'PENDING' | 'FAILED' | 'ARCHIVED' | 'DELETED' | 'SYNC_FAILED';
  public lastSyncedAt!: Date | null;
  public lastSyncAttemptAt!: Date | null;
  public archivedAt!: Date | null;
  public lastError!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AttendanceBackupFile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'departments',
        key: 'id',
      },
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    section: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subjects',
        key: 'id',
      },
    },
    facultyAssignmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'faculty_assignments',
        key: 'id',
      },
    },
    googleDriveFolderId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    googleDriveFileId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastSyncAttemptAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    archivedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'attendance_backup_files',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester', 'section', 'subjectId'],
        name: 'attendance_backup_files_scope_unique',
      },
      { fields: ['googleDriveFileId'] },
      { fields: ['facultyAssignmentId'] },
      { fields: ['subjectId'] },
      { fields: ['status'] },
    ],
  }
);

AttendanceBackupFile.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
AttendanceBackupFile.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
AttendanceBackupFile.belongsTo(FacultyAssignment, { as: 'facultyAssignment', foreignKey: 'facultyAssignmentId' });

export default AttendanceBackupFile;
