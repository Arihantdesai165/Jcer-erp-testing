import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';

class ConsolidatedAttendanceBackupFile extends Model {
  public id!: string;
  public academicYear!: string;
  public departmentId!: string;
  public semester!: number;
  public googleDriveFolderId!: string;
  public googleDriveFileId!: string;
  public googleDriveFileUrl!: string | null;
  public fileName!: string;
  public status!: 'SYNCED' | 'PENDING' | 'FAILED';
  public lastSyncedAt!: Date | null;
  public lastError!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ConsolidatedAttendanceBackupFile.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    academicYear: {
      type: DataTypes.STRING(50),
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
    googleDriveFolderId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    googleDriveFileId: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    googleDriveFileUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('SYNCED', 'PENDING', 'FAILED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    lastSyncedAt: {
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
    tableName: 'consolidated_attendance_backup_files',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester'],
        name: 'uq_consolidated_att_backup_cohort',
      },
      { fields: ['googleDriveFileId'] },
      { fields: ['status'] },
    ],
  }
);

ConsolidatedAttendanceBackupFile.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });

export default ConsolidatedAttendanceBackupFile;
