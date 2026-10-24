import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Subject from './Subject';
import Department from './Department';
import MarksBackupFile from './MarksBackupFile';

class MarksBackupJob extends Model {
  public id!: string;
  public subjectId!: string;
  public semester!: number;
  public academicYear!: string;
  public departmentId!: string;
  public backupFileId!: string | null;
  public action!: 'CREATE' | 'UPDATE' | 'SYNC';
  public status!: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  public attemptCount!: number;
  public maxAttempts!: number;
  public lastAttemptAt!: Date | null;
  public nextAttemptAt!: Date | null;
  public completedAt!: Date | null;
  public errorMessage!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MarksBackupJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    backupFileId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'marks_backup_files',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    action: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'UPDATE',
    },
    status: {
      type: DataTypes.STRING(50),
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
      defaultValue: DataTypes.NOW,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'marks_backup_jobs',
    timestamps: true,
    indexes: [
      { fields: ['status', 'nextAttemptAt'] },
      { fields: ['subjectId', 'semester', 'academicYear'] },
    ],
  }
);

MarksBackupJob.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
MarksBackupJob.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
MarksBackupJob.belongsTo(MarksBackupFile, { as: 'backupFile', foreignKey: 'backupFileId' });

export default MarksBackupJob;
