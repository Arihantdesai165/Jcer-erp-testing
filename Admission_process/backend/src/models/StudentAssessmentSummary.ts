import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import AssessmentConfiguration from './AssessmentConfiguration';
import Student from './Student';

class StudentAssessmentSummary extends Model {
  public id!: string;
  public assessmentConfigurationId!: string;
  public studentId!: string;
  public rawQuestionTotals!: Record<string, number>;
  public bestOfDetails!: any;
  public finalCieMarks!: number;
  public percentage!: number;
  public completionStatus!: 'NOT_STARTED' | 'INCOMPLETE' | 'COMPLETED';
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public assessmentConfiguration?: AssessmentConfiguration;
  public student?: Student;
}

StudentAssessmentSummary.init(
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
    rawQuestionTotals: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    bestOfDetails: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    finalCieMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    completionStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'NOT_STARTED',
    },
  },
  {
    sequelize: db,
    tableName: 'student_assessment_summaries',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['assessmentConfigurationId', 'studentId'],
        name: 'uq_student_assessment_summary',
      },
      { fields: ['assessmentConfigurationId'] },
      { fields: ['studentId'] },
    ],
  }
);

StudentAssessmentSummary.belongsTo(AssessmentConfiguration, {
  as: 'assessmentConfiguration',
  foreignKey: 'assessmentConfigurationId',
});
StudentAssessmentSummary.belongsTo(Student, { as: 'student', foreignKey: 'studentId' });

AssessmentConfiguration.hasMany(StudentAssessmentSummary, {
  as: 'summaries',
  foreignKey: 'assessmentConfigurationId',
});
Student.hasMany(StudentAssessmentSummary, {
  as: 'assessmentSummaries',
  foreignKey: 'studentId',
});

export default StudentAssessmentSummary;
