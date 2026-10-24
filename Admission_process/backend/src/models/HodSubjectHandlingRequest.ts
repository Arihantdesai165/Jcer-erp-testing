import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';
import Subject from './Subject';
import FacultyAssignment from './FacultyAssignment';

class HodSubjectHandlingRequest extends Model {
  public id!: string;
  public hodUserId!: string;
  public departmentId!: string;
  public semester!: number;
  public subjectId!: string;
  public academicYear!: string;
  public reason!: string | null;
  public status!: 'PENDING' | 'APPROVED' | 'REJECTED';
  public rejectionReason!: string | null;
  public reviewedBy!: string | null;
  public reviewedAt!: Date | null;
  public teachingAssignmentId!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

HodSubjectHandlingRequest.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    hodUserId: {
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
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    subjectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'subjects',
        key: 'id',
      },
    },
    academicYear: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: '2026-27',
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    teachingAssignmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'faculty_assignments',
        key: 'id',
      },
    },
  },
  {
    sequelize: db,
    tableName: 'hod_subject_handling_requests',
    timestamps: true,
    indexes: [
      { fields: ['hodUserId'] },
      { fields: ['departmentId'] },
      { fields: ['subjectId'] },
      { fields: ['semester'] },
      { fields: ['academicYear'] },
      { fields: ['status'] },
    ],
  }
);

HodSubjectHandlingRequest.belongsTo(User, { as: 'hodUser', foreignKey: 'hodUserId' });
HodSubjectHandlingRequest.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
HodSubjectHandlingRequest.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
HodSubjectHandlingRequest.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewedBy' });
HodSubjectHandlingRequest.belongsTo(FacultyAssignment, { as: 'teachingAssignment', foreignKey: 'teachingAssignmentId' });

export default HodSubjectHandlingRequest;
