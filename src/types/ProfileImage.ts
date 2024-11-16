// types/ProfileImage.ts
export interface ProfileImage {
    profileImageURL: string;
    imageOffsetWidth: number;
    imageOffsetHeight: number;
 }
 
 export function fromFirebase(data: any): ProfileImage {
    return {
        profileImageURL: data.profileImageURL || '',
        imageOffsetWidth: data.imageOffsetWidth || 0,
        imageOffsetHeight: data.imageOffsetHeight || 0
    };
 }
 
 export class ProfileImage {
    static fromFirebase(data: any): ProfileImage {
        return fromFirebase(data);
    }
 }