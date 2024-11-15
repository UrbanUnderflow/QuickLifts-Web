export interface BodyWeight {
    id: string;
    oldWeight: number;
    newWeight: number;
    frontUrl?: string;
    backUrl?: string;
    sideUrl?: string;
    createdAt: number;
    updatedAt: number;
  }
  
  export function createBodyWeight(data: Partial<BodyWeight>): BodyWeight {
    const now = Date.now() / 1000; // Convert to seconds for Firebase
    return {
      id: crypto.randomUUID(),
      oldWeight: data.oldWeight || 0,
      newWeight: data.newWeight || 0,
      frontUrl: data.frontUrl || "",
      backUrl: data.backUrl || "",
      sideUrl: data.sideUrl || "",
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now
    };
  }
  
  export function bodyWeightFromFirestore(data: any): BodyWeight {
    return {
      id: data.id || crypto.randomUUID(),
      oldWeight: data.oldWeight || 0,
      newWeight: data.newWeight || 0,
      frontUrl: data.frontUrl || "",
      backUrl: data.backUrl || "",
      sideUrl: data.sideUrl || "",
      createdAt: data.createdAt || 0,
      updatedAt: data.updatedAt || 0
    };
  }
  
  export function bodyWeightToFirestore(bodyWeight: BodyWeight): Record<string, any> {
    return {
      oldWeight: bodyWeight.oldWeight,
      newWeight: bodyWeight.newWeight,
      frontUrl: bodyWeight.frontUrl,
      backUrl: bodyWeight.backUrl,
      sideUrl: bodyWeight.sideUrl,
      createdAt: bodyWeight.createdAt,
      updatedAt: bodyWeight.updatedAt
    };
  }