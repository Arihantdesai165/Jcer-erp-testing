import { DataTypes, Model } from 'sequelize';
import db from '../config/database';
import User from './User';
import Department from './Department';

class Student extends Model {
  public id!: string;
  public userId!: string;
  public usn!: string;
  public enrollmentNumber!: string;
  public rollNumber!: string;
  public batchYear!: number;
  public admissionBatch!: string | null;
  public batch!: string;
  public departmentId!: string;
  public semester!: number;
  public dateOfBirth!: Date | null;
  public address!: string;
  public fatherName!: string;
  public motherName!: string;
  public parentPhone!: string;
  public parentEmail!: string;
  public admissionStatus!: 'PENDING' | 'VALIDATED' | 'APPROVED' | 'REJECTED';
  public admissionType!: 'FRESH' | 'LATERAL' | 'EXISTING' | string;
  public initialSemester!: number;
  public section!: string | null;
  public sectionId!: string | null;
  public scheme!: string | null;
  public gender!: string | null;
  public previousCollege!: string | null;
  public currentAcademicYear!: string;
  public lastPromotedAt!: Date | null;
  public lastPromotedBy!: string | null;
  public user!: any;
  public department!: any;
  public admission?: any;
  public createdAt!: Date;
  public updatedAt!: Date;
}

Student.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    usn: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },
    enrollmentNumber: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    rollNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    batchYear: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    admissionBatch: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: null,
    },
    batch: {
      type: DataTypes.VIRTUAL,
      get() {
        const adm = this.getDataValue('admissionBatch');
        if (adm) {
          const match = String(adm).match(/^(\d{4})[-–](\d{4})$/);
          if (match && parseInt(match[2], 10) - parseInt(match[1], 10) === 4) {
            return `${match[1]}–${match[2]}`;
          }
        }
        const bYear = this.getDataValue('batchYear') || 2026;
        return `${bYear}–${bYear + 4}`;
      },
    },
    departmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: Department,
        key: 'id',
      },
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    dateOfBirth: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fatherName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    motherName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    parentEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    admissionStatus: {
      type: DataTypes.ENUM('PENDING', 'VALIDATED', 'APPROVED', 'REJECTED'),
      defaultValue: 'APPROVED',
    },
    admissionType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'FRESH',
    },
    initialSemester: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    section: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    sectionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'sections',
        key: 'id',
      },
    },
    scheme: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    gender: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
    },
    previousCollege: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    currentAcademicYear: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: '2026-2027',
    },
    lastPromotedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastPromotedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: User,
        key: 'id',
      },
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize: db,
    tableName: 'students',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['usn'],
      },
      {
        fields: ['enrollmentNumber'],
      },
      {
        fields: ['departmentId'],
      },
      {
        fields: ['semester'],
      },
      {
        fields: ['sectionId'],
      },
    ],
  }
);

import Admission from './Admission';
import Section from './Section';

// Associations
Student.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Student.belongsTo(Department, { as: 'department', foreignKey: 'departmentId' });
Student.belongsTo(Section, { as: 'sectionEntity', foreignKey: 'sectionId' });
Section.hasMany(Student, { as: 'students', foreignKey: 'sectionId' });
User.hasOne(Student, { as: 'student', foreignKey: 'userId' });
Student.hasOne(Admission, { as: 'admission', foreignKey: 'userId', sourceKey: 'userId' });
Admission.belongsTo(Student, { as: 'student', foreignKey: 'userId', targetKey: 'userId' });

export { Student };
export default Student;