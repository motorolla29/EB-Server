class UserDto {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.surname = user.surname;
    this.patronymic = user.patronymic;
    this.dateOfBirth = user.dateOfBirth;
    this.gender = user.gender;
    this.email = user.email;
    this.phone = user.phone;
    this.role = user.role;
    this.photo = user.photo;
    this.isActivated = user.isActivated;
  }
}

module.exports = UserDto;
