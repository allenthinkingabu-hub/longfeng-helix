package com.longfeng.anonymousservice.dto;

/** SC-00-T02 · biz §10.6 observerContext — masked student identity for parent/teacher view. */
public class ObserverContextDto {
    private String role;                // PARENT / TEACHER
    private String studentMaskedName;   // e.g. "Y***"
    private String expiresAt;           // ISO 8601 — PARENT 30d / TEACHER 90d

    public ObserverContextDto() {}
    public ObserverContextDto(String role, String studentMaskedName, String expiresAt) {
        this.role = role;
        this.studentMaskedName = studentMaskedName;
        this.expiresAt = expiresAt;
    }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getStudentMaskedName() { return studentMaskedName; }
    public void setStudentMaskedName(String studentMaskedName) { this.studentMaskedName = studentMaskedName; }
    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
}
