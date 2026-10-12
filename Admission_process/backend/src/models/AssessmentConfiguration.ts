import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import Department from './Department';
import Subject from './Subject';
import User from './User';

export interface SubQuestionDef {
  id: string; // e.g. 'q1_a'
  label: string; // e.g. 'a' or '1(a)'
  maxMarks: number;
  isOptional?: boolean;
}

export interface MainQuestionDef {
  id: string; // e.g. 'q1'
  questionNumber: number; // e.g. 1
  label: string; // e.g. 'Q1'
  maxMarks: number; // Sum of subquestions or explicitly specified
  subquestions: SubQuestionDef[];
}

export interface QuestionGroupRule {
  id: string; // e.g. 'g1'
  name: string; // e.g. 'Group 1 (Q1 OR Q2)'
  questionIds: string[]; // e.g. ['q1', 'q2']
  chooseType: 'BEST_OF_1' | 'BEST_OF_N' | 'COMPULSORY';
  maxMarks: number; // e.g. 25
}

export interface AttemptRulesDef {
  type: 'GROUPED_BEST_OF' | 'COMPULSORY_ALL';
  groups?: QuestionGroupRule[];
}

class AssessmentConfiguration extends Model {
  public id!: string;
  public departmentId!: string;
  public semester!: number;
  public academicYear!: string;
  public subjectId!: string;
  public assessmentType!: 'CIE1' | 'CIE2';
  public configurationVersion!: number;
  public maximumMarks!: number;
  public questionPattern!: MainQuestionDef[];
  public attemptRules!: AttemptRulesDef;
  public status!:
    | 'DRAFT'
    | 'CONFIGURED'
    | 'SAVED'
    | 'FINALIZED'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'RETURNED'
    | 'RESUBMITTED'
    | 'APPROVED'
    | 'PUBLISHED';
  public submittedAt!: Date | null;
  public submittedBy!: string | null;
  public assignedHodId!: string | null;
  public hodReviewComment!: string | null;
  public reviewedAt!: Date | null;
  public reviewedBy!: string | null;
  public approvedAt!: Date | null;
  public approvedBy!: string | null;
  public isPublished!: boolean;
  public publishedAt!: Date | null;
  public publishedBy!: string | null;
  public submissionCount!: number;
  public createdBy!: string | null;
  public updatedBy!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public department?: Department;
  public subject?: Subject;
  public creator?: User;
  public updater?: User;
  public submitter?: User;
  public assignedHod?: User;
  public reviewer?: User;
  public approver?: User;
  public publisher?: User;
  public reviewHistory?: any[];
}

AssessmentConfiguration.init(
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
    assessmentType: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    configurationVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    maximumMarks: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 50.0,
    },
    questionPattern: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    attemptRules: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: { type: 'COMPULSORY_ALL' },
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    submittedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    assignedHodId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    hodReviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    publishedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    submissionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
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
    tableName: 'assessment_configurations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['academicYear', 'departmentId', 'semester', 'subjectId', 'assessmentType'],
        name: 'uq_assessment_config_context',
      },
      { fields: ['subjectId'] },
      { fields: ['departmentId'] },
      { fields: ['academicYear'] },
      { fields: ['status'] },
      { fields: ['isPublished'] },
      { fields: ['assignedHodId'] },
    ],
  }
);

AssessmentConfiguration.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
AssessmentConfiguration.belongsTo(Subject, { as: 'subject', foreignKey: 'subjectId' });
AssessmentConfiguration.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });
AssessmentConfiguration.belongsTo(User, { as: 'updater', foreignKey: 'updatedBy' });
AssessmentConfiguration.belongsTo(User, { as: 'submitter', foreignKey: 'submittedBy' });
AssessmentConfiguration.belongsTo(User, { as: 'assignedHod', foreignKey: 'assignedHodId' });
AssessmentConfiguration.belongsTo(User, { as: 'reviewer', foreignKey: 'reviewedBy' });
AssessmentConfiguration.belongsTo(User, { as: 'approver', foreignKey: 'approvedBy' });
AssessmentConfiguration.belongsTo(User, { as: 'publisher', foreignKey: 'publishedBy' });

export { AssessmentConfiguration };
export default AssessmentConfiguration;
