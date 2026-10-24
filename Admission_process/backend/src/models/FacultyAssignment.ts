import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';
import Subject from './Subject';
import Teacher from './Teacher';

class FacultyAssignment extends Model {
  public id!: string;
  public teacherId!: string | null;
  public userId!: string;
  public departmentId!: string;
  public subjectId!: string;
  public semester!: number;
  public section!: string;
  public branch!: string | null;
  public academicYear!: string;
  public attendanceAccess!: boolean;
  public marksAccess!: boolean;
  public createdByHODId!: string | null;
  public assignmentType!: 'REGULAR' | 'HOD_SUBJECT_HANDLING' | string;
  public status!: 'ACTIVE' | 'INACTIVE' | 'TRANSFERRED' | 'ENDED';
  public startDate!: string | null;
  public endDate!: string | null;
  public previousFacultyAssignmentId!: string | null;
  public transferReason!: string | null;
  public transferredAt!: Date | null;
  public transferredByHODId!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FacultyAssignment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'teachers',
        key: 'id',
      },
    },
    userId: {
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
      allowNull: false,
      defaultValue: 'A',
    },
    branch: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    attendanceAccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    marksAccess: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdByHODId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    assignmentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'REGULAR',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'TRANSFERRED', 'ENDED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    previousFacultyAssignmentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'faculty_assignments',
        key: 'id',
      },
    },
    transferReason: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    transferredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transferredByHODId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize: db,
    tableName: 'faculty_assignments',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['departmentId'] },
      { fields: ['subjectId'] },
      { fields: ['academicYear'] },
      { fields: ['status'] },
      { fields: ['previousFacultyAssignmentId'] },
    ],
  }
);

FacultyAssignment.belongsTo(User, { as: 'user', foreignKey: 'userId' });
FacultyAssignment.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
FacultyAssignment.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
FacultyAssignment.belongsTo(Teacher, { as: 'teacher', foreignKey: 'teacherId' });
FacultyAssignment.belongsTo(FacultyAssignment, { as: 'previousAssignment', foreignKey: 'previousFacultyAssignmentId' });
FacultyAssignment.belongsTo(User, { as: 'transferredByHOD', foreignKey: 'transferredByHODId' });

export default FacultyAssignment;
