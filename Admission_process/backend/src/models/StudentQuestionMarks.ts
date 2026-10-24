import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AssessmentConfiguration from './AssessmentConfiguration';
import Student from './Student';
import User from './User';

class StudentQuestionMarks extends Model {
  public id!: string;
  public assessmentConfigurationId!: string;
  public studentId!: string;
  public questionId!: string;
  public subquestionId!: string;
  public marksObtained!: number | null;
  public isAttempted!: boolean;
  public recordStatus!: 'SAVED' | 'DRAFT';
  public updatedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public assessmentConfiguration?: AssessmentConfiguration;
  public student?: Student;
  public updater?: User;
}

StudentQuestionMarks.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assessmentConfigurationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'assessment_configurations',
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
    questionId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    subquestionId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    marksObtained: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    isAttempted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    recordStatus: {
      type: DataTypes.STRING(20),
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
    tableName: 'student_question_marks',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['assessmentConfigurationId', 'studentId', 'questionId', 'subquestionId'],
        name: 'uq_student_subquestion_mark',
      },
      { fields: ['assessmentConfigurationId'] },
      { fields: ['studentId'] },
    ],
  }
);

StudentQuestionMarks.belongsTo(AssessmentConfiguration, {
  as: 'assessmentConfiguration',
  foreignKey: 'assessmentConfigurationId',
});
StudentQuestionMarks.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });
StudentQuestionMarks.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });

AssessmentConfiguration.hasMany(StudentQuestionMarks, {
  as: 'questionMarks',
  foreignKey: 'assessmentConfigurationId',
});
Student.hasMany(StudentQuestionMarks, { as: 'bitwiseMarks', foreignKey: 'studentId' });

export default StudentQuestionMarks;
