class UserDto {
  constructor(user) {
    this.id = user.id;
    this.name = user.name;
    this.email = user.email;
    this.role = user.role;
    this.photo = user.photo;
    this.isActivated = user.isActivated;
  }
}

module.exports = UserDto;
