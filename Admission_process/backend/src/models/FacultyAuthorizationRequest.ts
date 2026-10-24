import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';
import Subject from './Subject';

class FacultyAuthorizationRequest extends Model {
  public id!: string;
  public facultyUserId!: string;
  public departmentId!: string;
  public subjectId!: string | null;
  public semester!: number;
  public section!: string;
  public academicYear!: string;
  public designation!: string;
  public createdByHODId!: string;
  public authority!: 'DEAN' | 'PRINCIPAL' | 'DEAN_ACADEMICS' | string;
  public sequence!: number;
  public status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'LOCKED' | string;
  public overallStatus!: 'PENDING_APPROVAL' | 'AUTHORIZED' | 'REJECTED' | string;
  public firstApprovedByUserId!: string | null;
  public firstApprovedByName!: string | null;
  public firstApprovedRole!: string | null;
  public firstApprovedAt!: Date | null;
  public rejectionReason!: string | null;
  public decidedByUserId!: string | null;
  public decidedByName!: string | null;
  public decidedByRole!: string | null;
  public decidedAt!: Date | null;
  public assignmentsData!: any[] | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FacultyAuthorizationRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    facultyUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
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
      allowNull: true,
      references: {
        model: 'subjects',
        key: 'id',
      },
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 1,
    },
    section: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: 'A',
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: '2026-27',
    },
    designation: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Assistant Professor',
    },
    createdByHODId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    authority: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'DEAN',
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    overallStatus: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'PENDING_APPROVAL',
    },
    firstApprovedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    firstApprovedByName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    firstApprovedRole: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    firstApprovedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    decidedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    decidedByName: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    decidedByRole: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    decidedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    assignmentsData: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: 'faculty_authorization_requests',
    timestamps: true,
    indexes: [
      { fields: ['facultyUserId'] },
      { fields: ['departmentId'] },
      { fields: ['status'] },
      { fields: ['overallStatus'] },
      { fields: ['authority'] },
      { fields: ['sequence'] },
      { fields: ['academicYear'] },
    ],
  }
);

FacultyAuthorizationRequest.belongsTo(User, { as: 'faculty', foreignKey: 'facultyUserId' });
FacultyAuthorizationRequest.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
FacultyAuthorizationRequest.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
FacultyAuthorizationRequest.belongsTo(User, { as: 'createdByHOD', foreignKey: 'createdByHODId' });
FacultyAuthorizationRequest.belongsTo(User, { as: 'decidedBy', foreignKey: 'decidedByUserId' });

export default FacultyAuthorizationRequest;
