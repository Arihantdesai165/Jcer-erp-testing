import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';

class MarksBackupFile extends Model {
  public id!: string;
  public academicYear!: string;
  public departmentId!: string;
  public semester!: number;
  public subjectId!: string;
  public fileName!: string;
  public googleDriveFolderId!: string | null;
  public googleDriveFileId!: string | null;
  public googleDriveFileUrl!: string | null;
  public status!: 'PENDING' | 'SYNCED' | 'ERROR';
  public lastSyncedAt!: Date | null;
  public lastError!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MarksBackupFile.init(
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
      onDelete: 'CASCADE',
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subjects',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    googleDriveFolderId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    googleDriveFileId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    googleDriveFileUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'marks_backup_files',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester', 'subjectId'],
        name: 'uq_marks_backup_file_subject',
      },
      { fields: ['subjectId'] },
      { fields: ['status'] },
    ],
  }
);

MarksBackupFile.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
MarksBackupFile.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });

export default MarksBackupFile;
