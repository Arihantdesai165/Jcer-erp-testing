import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';
import Student from './Student';
import User from './User';
import AssessmentConfiguration from './AssessmentConfiguration';
import AssignmentConfiguration from './AssignmentConfiguration';

class FinalInternalMarks extends Model {
  public id!: string;
  public departmentId!: string;
  public semester!: number;
  public academicYear!: string;
  public subjectId!: string;
  public studentId!: string;
  public cie1ConfigId!: string | null;
  public cie1Marks!: number | null;
  public cie2ConfigId!: string | null;
  public cie2Marks!: number | null;
  public cieAverageOrPolicyResult!: number | null;
  public assignmentConfigId!: string | null;
  public assignmentRawMarks!: number | null;
  public assignmentScaledMarks!: number | null;
  public finalInternalMarks!: number | null;
  public maxFinalInternalMarks!: number;
  public calculationPolicy!: any;
  public status!: 'INCOMPLETE' | 'READY' | 'SAVED' | 'FINALIZED';
  public finalizedAt!: Date | null;
  public finalizedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public department?: Department;
  public subject?: Subject;
  public student?: Student;
  public finalizer?: User;
}

FinalInternalMarks.init(
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
    cie1ConfigId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'assessment_configurations',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    cie1Marks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    cie2ConfigId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'assessment_configurations',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    cie2Marks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    cieAverageOrPolicyResult: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    assignmentConfigId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'assignment_configurations',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    assignmentRawMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    assignmentScaledMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    finalInternalMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    maxFinalInternalMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 50.0,
    },
    calculationPolicy: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        cieRule: 'AVERAGE', // 'AVERAGE' | 'BEST_OF'
        formula: 'STANDARD_VTU_50', // standard formula description
        finalMax: 50,
      },
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'INCOMPLETE',
    },
    finalizedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finalizedBy: {
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
    tableName: 'final_internal_marks',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester', 'subjectId', 'studentId'],
        name: 'uq_final_internal_marks_student',
      },
      { fields: ['subjectId'] },
      { fields: ['studentId'] },
    ],
  }
);

FinalInternalMarks.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
FinalInternalMarks.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
FinalInternalMarks.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });
FinalInternalMarks.belongsTo(AssessmentConfiguration, { as: 'cie1Config', foreignKey: 'cie1ConfigId' });
FinalInternalMarks.belongsTo(AssessmentConfiguration, { as: 'cie2Config', foreignKey: 'cie2ConfigId' });
FinalInternalMarks.belongsTo(AssignmentConfiguration, { as: 'assignmentConfig', foreignKey: 'assignmentConfigId' });
FinalInternalMarks.belongsTo(User, { as: 'finalizer', foreignKey: 'finalizedBy' });

Student.hasMany(FinalInternalMarks, { as: 'finalInternalMarks', foreignKey: 'studentId' });

export default FinalInternalMarks;
