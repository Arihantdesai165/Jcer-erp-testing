import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';
import User from './User';

export type ReleaseType = 'ATTENDANCE' | 'MARKS';
export type AssessmentType = 'ATTENDANCE' | 'CIE1' | 'CIE2' | 'ASSIGNMENT' | 'FINAL_INTERNAL' | 'EXTERNAL';
export type AcademicReleaseStatus = 'NOT_RELEASED' | 'READY' | 'RELEASED' | 'UPDATE_AVAILABLE' | 'SOURCE_INVALID';

export class AcademicRelease extends Model {
  public id!: string;
  public departmentId!: string;
  public academicYear!: string;
  public semester!: number;
  public subjectId!: string;
  public releaseType!: ReleaseType;
  public assessmentType!: AssessmentType;
  public status!: AcademicReleaseStatus;
  public sourceType!: 'GOOGLE_DRIVE' | 'SYSTEM';
  public googleDriveFileId!: string | null;
  public googleDriveFileName!: string | null;
  public sourceFingerprint!: string | null;
  public sourceVersion!: string | null;
  public totalStudentsCount!: number;
  public releasedByUserId!: string | null;
  public releasedAt!: Date;
  public lastReviewedAt!: Date | null;
  public metadata!: any | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly department?: Department;
  public readonly subject?: Subject;
  public readonly releasedByUser?: User;
}

AcademicRelease.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    academicYear: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
    releaseType: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    assessmentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'RELEASED',
    },
    sourceType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'GOOGLE_DRIVE',
    },
    googleDriveFileId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    googleDriveFileName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sourceFingerprint: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    sourceVersion: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    totalStudentsCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    releasedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    releasedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    lastReviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'academic_releases',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['departmentId', 'academicYear', 'semester', 'subjectId', 'releaseType', 'assessmentType'],
        name: 'uq_academic_release_item',
      },
      {
        fields: ['academicYear', 'departmentId', 'semester', 'subjectId'],
        name: 'idx_academic_releases_lookup',
      },
      {
        fields: ['status'],
      },
    ],
  }
);

AcademicRelease.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
AcademicRelease.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
AcademicRelease.belongsTo(User, { as: 'releasedByUser', foreignKey: 'releasedByUserId' });

export default AcademicRelease;
