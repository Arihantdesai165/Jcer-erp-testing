import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Student from './Student';
import Department from './Department';

class StudentAcademicEnrollment extends Model {
  public id!: string;
  public studentId!: string;
  public academicYearId!: string;
  public schemeId!: string;
  public departmentId!: string;
  public semesterId!: number;
  public sectionId!: string | null;
  public rollNumber!: string | null;
  public entrySemester!: number;
  public status!: 'ACTIVE' | 'PROMOTED' | 'COMPLETED' | 'INACTIVE' | 'DROPPED';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public student?: Student;
  public department?: Department;
}

StudentAcademicEnrollment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Student,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    academicYearId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '2026-27',
    },
    schemeId: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: '2025',
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Department,
        key: 'id',
      },
    },
    semesterId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    sectionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    rollNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    entrySemester: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
  },
  {
    sequelize: db,
    tableName: 'student_academic_enrollments',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['studentId', 'academicYearId', 'semesterId'],
      },
      {
        fields: ['studentId'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['academicYearId'],
      },
    ],
  }
);

// Associations
StudentAcademicEnrollment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
StudentAcademicEnrollment.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
Student.hasMany(StudentAcademicEnrollment, { foreignKey: 'studentId', as: 'academicEnrollments' });

export default StudentAcademicEnrollment;
