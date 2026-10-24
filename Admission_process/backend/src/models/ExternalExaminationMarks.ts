import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';
import Student from './Student';
import User from './User';

class ExternalExaminationMarks extends Model {
  public id!: string;
  public departmentId!: string;
  public semester!: number;
  public academicYear!: string;
  public subjectId!: string;
  public studentId!: string;
  public externalMarks!: number | null;
  public maximumMarks!: number;
  public status!: 'DRAFT' | 'SAVED' | 'FINALIZED';
  public updatedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public department?: Department;
  public subject?: Subject;
  public student?: Student;
  public updater?: User;
}

ExternalExaminationMarks.init(
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
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '2026-27',
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
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    externalMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    maximumMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 100.0,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'SAVED',
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
  },
  {
    sequelize: db,
    tableName: 'external_examination_marks',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester', 'subjectId', 'studentId'],
        name: 'uq_external_exam_marks_student',
      },
      { fields: ['subjectId'] },
      { fields: ['studentId'] },
    ],
  }
);

ExternalExaminationMarks.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
ExternalExaminationMarks.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
ExternalExaminationMarks.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });
ExternalExaminationMarks.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

Student.hasMany(ExternalExaminationMarks, { as: 'externalMarksRecords', foreignKey: 'studentId' });

export default ExternalExaminationMarks;
