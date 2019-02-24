import React from "react"
import { Link } from "gatsby"

import style from '../../packages/index.scss';


const NavBar = () => (
  <nav className="NavBar">
    <ul className="Menu">
      <li className="Menu-item">
        <Link to={`/`} className="Menu-link">
          Home
        </Link>
      </li>
      <li className="Menu-item">
        <Link to={`/base`} className="Menu-link">
        Docs
        </Link>
      </li>
    </ul>
  </nav>
)

class Layout extends React.Component {
  render() {
    const { children } = this.props
    // const rootPath = `${__PATH_PREFIX__}/`
    
    return (
      <div>
        <NavBar />
        <main>{children}</main>
        <footer className="Footer Footer--p5">
          © {new Date().getFullYear()}, Built with
          {` `}
          <a href="https://www.gatsbyjs.org">Gatsby</a>
        </footer>
      </div>
    )
  }
}

export default Layout
